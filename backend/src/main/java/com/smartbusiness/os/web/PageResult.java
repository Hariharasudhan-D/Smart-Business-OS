package com.smartbusiness.os.web;

import java.util.List;

/** One page of a list: the rows, how many there are in all, and whether more pages follow. Pages start at 0. */
public record PageResult<T>(List<T> items, long total, int page, int size, boolean hasMore) {
  public static final int MAX_SIZE = 200;

  public static int clampSize(Integer size, int fallback) {
    return size == null || size < 1 ? fallback : Math.min(size, MAX_SIZE);
  }

  public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
    return new PageResult<>(items, total, page, size, (long) (page + 1) * size < total);
  }
}
