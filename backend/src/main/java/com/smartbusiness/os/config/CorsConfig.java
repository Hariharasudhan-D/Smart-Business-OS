package com.smartbusiness.os.config;

import com.smartbusiness.os.auth.AuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
  @Bean
  WebMvcConfigurer webConfigurer(@Value("${app.cors.allowed-origins}") String[] origins, AuthInterceptor auth) {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        // Only the listed sites, only the methods and headers the OS and app use; no cookies (the token is a header).
        registry.addMapping("/api/**")
            .allowedOrigins(origins)
            .allowedMethods("GET", "POST", "PATCH", "DELETE")
            .allowedHeaders("Authorization", "Content-Type")
            .allowCredentials(false)
            .maxAge(3600);
      }

      @Override
      public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auth).addPathPatterns("/api/**");
      }
    };
  }
}
