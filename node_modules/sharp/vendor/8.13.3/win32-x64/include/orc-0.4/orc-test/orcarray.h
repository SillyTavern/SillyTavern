
#ifndef _ORC_ARRAY_H_
#define _ORC_ARRAY_H_

#include <orc-test/orctest.h>
#include <orc-test/orcrandom.h>
#include <orc/orc.h>
#include <orc/orcdebug.h>

#define ORC_OOB_VALUE 0xa5

typedef struct _OrcArray OrcArray;
struct _OrcArray {
  void *data;
  int stride;
  int element_size;
  int n,m;

  void *alloc_data;
  int alloc_len;
  void *aligned_data;
};

enum {
  ORC_PATTERN_RANDOM = 0,
  ORC_PATTERN_FLOAT_SMALL,
  ORC_PATTERN_FLOAT_SPECIAL,
  ORC_PATTERN_FLOAT_DENORMAL
};

ORC_TEST_API
OrcArray *orc_array_new (int n, int m, int element_size, int misalignment,
    int alignment);

ORC_TEST_API
void orc_array_free (OrcArray *array);

ORC_TEST_API
void orc_array_set_pattern (OrcArray *array, int value);

ORC_TEST_API
void orc_array_set_random (OrcArray *array, OrcRandomContext *context);

ORC_TEST_API
void orc_array_set_pattern_2 (OrcArray *array, OrcRandomContext *context,
    int type);

ORC_TEST_API
int orc_array_compare (OrcArray *array1, OrcArray *array2, int flags);

ORC_TEST_API
int orc_array_check_out_of_bounds (OrcArray *array);

#endif

