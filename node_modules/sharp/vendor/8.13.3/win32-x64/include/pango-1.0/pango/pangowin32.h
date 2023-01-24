/* Pango
 * pangowin32.h:
 *
 * Copyright (C) 1999 Red Hat Software
 * Copyright (C) 2000 Tor Lillqvist
 * Copyright (C) 2001 Alexander Larsson
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	 See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

#ifndef __PANGOWIN32_H__
#define __PANGOWIN32_H__

#include <glib.h>
#include <pango/pango-font.h>
#include <pango/pango-layout.h>

G_BEGIN_DECLS

#define STRICT
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0600	/* To get ClearType-related macros */
#endif
#include <windows.h>
#undef STRICT

/**
 * PANGO_RENDER_TYPE_WIN32:
 *
 * A string constant identifying the Win32 renderer. The associated quark (see
 * g_quark_from_string()) is used to identify the renderer in pango_find_map().
 */
#define PANGO_RENDER_TYPE_WIN32 "PangoRenderWin32"

/* Calls for applications
 */
#ifndef PANGO_DISABLE_DEPRECATED
PANGO_DEPRECATED_FOR(pango_font_map_create_context)
PangoContext * pango_win32_get_context        (void);
#endif

PANGO_AVAILABLE_IN_ALL
void           pango_win32_render             (HDC               hdc,
					       PangoFont        *font,
					       PangoGlyphString *glyphs,
					       gint              x,
					       gint              y);
PANGO_AVAILABLE_IN_ALL
void           pango_win32_render_layout_line (HDC               hdc,
					       PangoLayoutLine  *line,
					       int               x,
					       int               y);
PANGO_AVAILABLE_IN_ALL
void           pango_win32_render_layout      (HDC               hdc,
					       PangoLayout      *layout,
					       int               x,
					       int               y);

PANGO_AVAILABLE_IN_ALL
void           pango_win32_render_transformed (HDC         hdc,
					       const PangoMatrix *matrix,
					       PangoFont         *font,
					       PangoGlyphString  *glyphs,
					       int                x,
					       int                y);

#ifndef PANGO_DISABLE_DEPRECATED

/* For shape engines
 */

PANGO_DEPRECATED_FOR(PANGO_GET_UNKNOWN_GLYPH)
PangoGlyph     pango_win32_get_unknown_glyph  (PangoFont        *font,
					       gunichar          wc);
PANGO_DEPRECATED
gint	      pango_win32_font_get_glyph_index(PangoFont        *font,
					       gunichar          wc);

PANGO_DEPRECATED
HDC            pango_win32_get_dc             (void);

PANGO_DEPRECATED
gboolean       pango_win32_get_debug_flag     (void);

PANGO_DEPRECATED
gboolean pango_win32_font_select_font        (PangoFont *font,
					      HDC        hdc);
PANGO_DEPRECATED
void     pango_win32_font_done_font          (PangoFont *font);
PANGO_DEPRECATED
double   pango_win32_font_get_metrics_factor (PangoFont *font);

#endif

/* API for libraries that want to use PangoWin32 mixed with classic
 * Win32 fonts.
 */
typedef struct _PangoWin32FontCache PangoWin32FontCache;

PANGO_AVAILABLE_IN_ALL
PangoWin32FontCache *pango_win32_font_cache_new          (void);
PANGO_AVAILABLE_IN_ALL
void                 pango_win32_font_cache_free         (PangoWin32FontCache *cache);

PANGO_AVAILABLE_IN_ALL
HFONT                pango_win32_font_cache_load         (PangoWin32FontCache *cache,
							  const LOGFONTA      *logfont);
PANGO_AVAILABLE_IN_1_16
HFONT                pango_win32_font_cache_loadw        (PangoWin32FontCache *cache,
							  const LOGFONTW      *logfont);
PANGO_AVAILABLE_IN_ALL
void                 pango_win32_font_cache_unload       (PangoWin32FontCache *cache,
							  HFONT                hfont);

PANGO_AVAILABLE_IN_ALL
PangoFontMap        *pango_win32_font_map_for_display    (void);
PANGO_AVAILABLE_IN_ALL
void                 pango_win32_shutdown_display        (void);
PANGO_AVAILABLE_IN_ALL
PangoWin32FontCache *pango_win32_font_map_get_font_cache (PangoFontMap       *font_map);

PANGO_AVAILABLE_IN_ALL
LOGFONTA            *pango_win32_font_logfont            (PangoFont          *font);
PANGO_AVAILABLE_IN_1_16
LOGFONTW            *pango_win32_font_logfontw           (PangoFont          *font);

PANGO_AVAILABLE_IN_1_12
PangoFontDescription *pango_win32_font_description_from_logfont (const LOGFONTA *lfp);

PANGO_AVAILABLE_IN_1_16
PangoFontDescription *pango_win32_font_description_from_logfontw (const LOGFONTW *lfp);

G_END_DECLS

#endif /* __PANGOWIN32_H__ */
