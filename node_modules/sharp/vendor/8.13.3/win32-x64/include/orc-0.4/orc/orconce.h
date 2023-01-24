
#ifndef _ORC_ONCE_H_
#define _ORC_ONCE_H_

#include <orc/orc.h>

ORC_BEGIN_DECLS

typedef struct _OrcMutex OrcMutex;

typedef struct _OrcOnce OrcOnce;

struct _OrcOnce {
  int inited;
  void *value;
};

ORC_API void orc_once_mutex_lock (void);
ORC_API void orc_once_mutex_unlock (void);

ORC_END_DECLS

#endif

