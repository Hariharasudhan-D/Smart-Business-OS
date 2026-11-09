package com.smartbusiness.os.db;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Measures the execution time of every SQL statement. The DataSource is wrapped so each
 * execute/executeQuery/executeUpdate/executeBatch call is timed:
 * <ul>
 *   <li>the time is added to the current request's {@link QueryStats} (printed by the request log);
 *   <li>a statement slower than {@code app.log.slow-query-ms} (200 ms by default) is logged with its SQL.
 * </ul>
 * Works for JPA/Hibernate and JdbcTemplate alike, with no extra library.
 */
@Configuration
public class QueryTimingConfig {
  private static final Logger log = LoggerFactory.getLogger("sql.timing");

  @Bean
  static BeanPostProcessor queryTimingDataSourceWrapper(@Value("${app.log.slow-query-ms:200}") long slowQueryMs) {
    return new BeanPostProcessor() {
      @Override
      public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof DataSource ds && !Proxy.isProxyClass(bean.getClass())) {
          return proxy(DataSource.class, ds, new DataSourceHandler(ds, slowQueryMs));
        }
        return bean;
      }
    };
  }

  @SuppressWarnings("unchecked")
  private static <T> T proxy(Class<T> type, Object target, InvocationHandler handler) {
    return (T) Proxy.newProxyInstance(QueryTimingConfig.class.getClassLoader(), new Class<?>[] {type}, handler);
  }

  /** Calls the real object; unwrap/isWrapperFor go straight to it so drivers and pools still find themselves. */
  private abstract static class Delegating implements InvocationHandler {
    final Object target;

    Delegating(Object target) {
      this.target = target;
    }

    Object call(Method m, Object[] args) throws Throwable {
      try {
        return m.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }

    Object maybeUnwrap(Object proxy, Method m, Object[] args) throws Throwable {
      if (m.getName().equals("unwrap") && args[0] instanceof Class<?> c && c.isInstance(proxy)) return proxy;
      if (m.getName().equals("isWrapperFor") && args[0] instanceof Class<?> c && c.isInstance(proxy)) return true;
      return call(m, args);
    }
  }

  private static final class DataSourceHandler extends Delegating {
    private final long slowMs;

    DataSourceHandler(DataSource target, long slowMs) {
      super(target);
      this.slowMs = slowMs;
    }

    @Override
    public Object invoke(Object proxy, Method m, Object[] args) throws Throwable {
      Object result = maybeUnwrap(proxy, m, args);
      if (m.getName().equals("getConnection") && result instanceof Connection c) {
        return proxy(Connection.class, c, new ConnectionHandler(c, slowMs));
      }
      return result;
    }
  }

  private static final class ConnectionHandler extends Delegating {
    private final long slowMs;

    ConnectionHandler(Connection target, long slowMs) {
      super(target);
      this.slowMs = slowMs;
    }

    @Override
    public Object invoke(Object proxy, Method m, Object[] args) throws Throwable {
      Object result = maybeUnwrap(proxy, m, args);
      String sql = args != null && args.length > 0 && args[0] instanceof String s ? s : null;
      return switch (m.getName()) {
        case "createStatement" -> proxy(Statement.class, result, new StatementHandler(result, null, slowMs));
        case "prepareStatement" -> proxy(PreparedStatement.class, result, new StatementHandler(result, sql, slowMs));
        case "prepareCall" -> proxy(CallableStatement.class, result, new StatementHandler(result, sql, slowMs));
        default -> result;
      };
    }
  }

  private static final class StatementHandler extends Delegating {
    private final String preparedSql;
    private final long slowMs;

    StatementHandler(Object target, String preparedSql, long slowMs) {
      super(target);
      this.preparedSql = preparedSql;
      this.slowMs = slowMs;
    }

    @Override
    public Object invoke(Object proxy, Method m, Object[] args) throws Throwable {
      if (!m.getName().startsWith("execute")) return maybeUnwrap(proxy, m, args);
      long start = System.nanoTime();
      try {
        return call(m, args);
      } finally {
        long nanos = System.nanoTime() - start;
        QueryStats.record(nanos);
        long ms = nanos / 1_000_000;
        if (ms >= slowMs) {
          String sql = preparedSql != null ? preparedSql : args != null && args.length > 0 && args[0] instanceof String s ? s : "(batch)";
          log.warn("Slow query {} ms: {}", ms, oneLine(sql));
        }
      }
    }

    private static String oneLine(String sql) {
      String s = sql.replaceAll("\\s+", " ").trim();
      return s.length() > 400 ? s.substring(0, 400) + "…" : s;
    }
  }
}
