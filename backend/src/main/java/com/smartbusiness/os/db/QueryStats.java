package com.smartbusiness.os.db;

/**
 * Per-request database statistics: how many SQL statements ran and how long they took in total.
 * The request timing log prints them, so a request that suddenly runs 50 queries (an N+1 problem)
 * or spends most of its time in the database stands out at once.
 */
public final class QueryStats {
  private static final ThreadLocal<long[]> CURRENT = new ThreadLocal<>(); // [count, totalNanos]

  private QueryStats() {}

  /** Starts counting for the current request. */
  public static void begin() {
    CURRENT.set(new long[2]);
  }

  /** Stops counting and returns {count, totalMillis}. */
  public static long[] end() {
    long[] s = CURRENT.get();
    CURRENT.remove();
    return s == null ? new long[] {0, 0} : new long[] {s[0], s[1] / 1_000_000};
  }

  static void record(long nanos) {
    long[] s = CURRENT.get();
    if (s != null) {
      s[0]++;
      s[1] += nanos;
    }
  }
}
