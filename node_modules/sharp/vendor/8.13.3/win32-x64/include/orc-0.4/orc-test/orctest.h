
#ifndef _ORC_TEST_TEST_H_
#define _ORC_TEST_TEST_H_

#include <orc/orc.h>
#include <orc/orcutils.h>

ORC_BEGIN_DECLS

#ifdef BUILDING_ORC_TEST
#define ORC_TEST_API ORC_API_EXPORT /* defined in config.h */
#else
#define ORC_TEST_API ORC_API_IMPORT
#endif

typedef enum {
  ORC_TEST_FAILED = 0,
  ORC_TEST_INDETERMINATE = 1,
  ORC_TEST_OK = 2
} OrcTestResult;

#define ORC_TEST_FLAGS_BACKUP (1<<0)
#define ORC_TEST_FLAGS_FLOAT (1<<1)
#define ORC_TEST_FLAGS_EMULATE (1<<2)

ORC_TEST_API
void          orc_test_init (void);

ORC_TEST_API
OrcTestResult orc_test_gcc_compile (OrcProgram *p);

ORC_TEST_API
OrcTestResult orc_test_gcc_compile_neon (OrcProgram *p);

ORC_TEST_API
OrcTestResult orc_test_gcc_compile_c64x (OrcProgram *p);

ORC_TEST_API
OrcTestResult orc_test_gcc_compile_mips (OrcProgram *p);

ORC_TEST_API
void          orc_test_random_bits (void *data, int n_bytes);

ORC_TEST_API
OrcTestResult orc_test_compare_output (OrcProgram *program);

ORC_TEST_API
OrcTestResult orc_test_compare_output_full (OrcProgram *program, int flags);

ORC_TEST_API
OrcTestResult orc_test_compare_output_backup (OrcProgram *program);

ORC_TEST_API
OrcProgram *  orc_test_get_program_for_opcode (OrcStaticOpcode *opcode);

ORC_TEST_API
OrcProgram *  orc_test_get_program_for_opcode_const (OrcStaticOpcode *opcode);

ORC_TEST_API
OrcProgram *  orc_test_get_program_for_opcode_param (OrcStaticOpcode *opcode);

ORC_TEST_API
void          orc_test_performance (OrcProgram *program, int flags);

ORC_TEST_API
double        orc_test_performance_full (OrcProgram *program, int flags,
                                         const char *target);

ORC_END_DECLS

#endif

