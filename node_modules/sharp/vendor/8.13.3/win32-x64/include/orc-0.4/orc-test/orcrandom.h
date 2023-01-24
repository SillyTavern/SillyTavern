
#ifndef _ORC_RANDOM_H_
#define _ORC_RANDOM_H_

#include <orc-test/orctest.h>

ORC_BEGIN_DECLS

typedef struct _OrcRandomContext OrcRandomContext;
struct _OrcRandomContext {
  unsigned int x;
};

ORC_TEST_API
void         orc_random_init (OrcRandomContext *context, int seed);

ORC_TEST_API
void         orc_random_bits (OrcRandomContext *context, void *data, int n_bytes);

ORC_TEST_API
void         orc_random_floats (OrcRandomContext *context, float *data, int n);

ORC_TEST_API
unsigned int orc_random (OrcRandomContext *context);

ORC_END_DECLS

#endif

