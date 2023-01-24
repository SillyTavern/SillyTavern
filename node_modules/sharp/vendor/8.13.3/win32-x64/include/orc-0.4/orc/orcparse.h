
#ifndef __ORC_PARSE_H__
#define __ORC_PARSE_H__

#include <orc/orc.h>

ORC_BEGIN_DECLS

ORC_API int orc_parse (const char *code, OrcProgram ***programs);
ORC_API int orc_parse_full (const char *code, OrcProgram ***programs, char **log);
ORC_API const char * orc_parse_get_init_function (OrcProgram *program);

ORC_END_DECLS

#endif

