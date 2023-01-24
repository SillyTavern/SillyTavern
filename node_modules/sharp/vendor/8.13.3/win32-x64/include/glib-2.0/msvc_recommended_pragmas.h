#ifndef _MSC_VER
#pragma error "This header is for Microsoft VC or clang-cl only."
#endif /* _MSC_VER */

/* Make MSVC more pedantic, this is a recommended pragma list
 * from _Win32_Programming_ by Rector and Newcomer.
 */
#ifndef __clang__
#pragma warning(error:4002) /* too many actual parameters for macro */
#pragma warning(error:4003) /* not enough actual parameters for macro */
#pragma warning(1:4010)     /* single-line comment contains line-continuation character */
#pragma warning(error:4013) /* 'function' undefined; assuming extern returning int */
#pragma warning(1:4016)     /* no function return type; using int as default */
#pragma warning(error:4020) /* too many actual parameters */
#pragma warning(error:4021) /* too few actual parameters */
#pragma warning(error:4027) /* function declared without formal parameter list */
#pragma warning(error:4029) /* declared formal parameter list different from definition */
#pragma warning(error:4033) /* 'function' must return a value */
#pragma warning(error:4035) /* 'function' : no return value */
#pragma warning(error:4045) /* array bounds overflow */
#pragma warning(error:4047) /* different levels of indirection */
#pragma warning(error:4049) /* terminating line number emission */
#pragma warning(error:4053) /* An expression of type void was used as an operand */
#pragma warning(error:4071) /* no function prototype given */
#pragma warning(disable:4101) /* unreferenced local variable */
#pragma warning(error:4150)

/* G_NORETURN */
#pragma warning(error:4646) /* function declared with __declspec(noreturn) has non-void return type */
#pragma warning(error:4715) /* 'function': not all control paths return a value */
#pragma warning(error:4098) /* 'void' function returning a value */

#pragma warning(disable:4244)	/* No possible loss of data warnings */
#pragma warning(disable:4305)   /* No truncation from int to char warnings */

#pragma warning(error:4819) /* The file contains a character that cannot be represented in the current code page */
#endif                      /* __clang__ */

/* work around Microsoft's premature attempt to deprecate the C-Library */
#define _CRT_SECURE_NO_WARNINGS
#define _CRT_NONSTDC_NO_WARNINGS
