// Copyright 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020 Lovell Fuller and contributors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <napi.h>
#include <vips/vips8>

#include "common.h"
#include "metadata.h"
#include "pipeline.h"
#include "utilities.h"
#include "stats.h"

static void* sharp_vips_init(void*) {
  vips_init("sharp");
  return nullptr;
}

Napi::Object init(Napi::Env env, Napi::Object exports) {
  static GOnce sharp_vips_init_once = G_ONCE_INIT;
  g_once(&sharp_vips_init_once, static_cast<GThreadFunc>(sharp_vips_init), nullptr);

  g_log_set_handler("VIPS", static_cast<GLogLevelFlags>(G_LOG_LEVEL_WARNING),
    static_cast<GLogFunc>(sharp::VipsWarningCallback), nullptr);

  // Methods available to JavaScript
  exports.Set("metadata", Napi::Function::New(env, metadata));
  exports.Set("pipeline", Napi::Function::New(env, pipeline));
  exports.Set("cache", Napi::Function::New(env, cache));
  exports.Set("concurrency", Napi::Function::New(env, concurrency));
  exports.Set("counters", Napi::Function::New(env, counters));
  exports.Set("simd", Napi::Function::New(env, simd));
  exports.Set("libvipsVersion", Napi::Function::New(env, libvipsVersion));
  exports.Set("format", Napi::Function::New(env, format));
  exports.Set("_maxColourDistance", Napi::Function::New(env, _maxColourDistance));
  exports.Set("_isUsingJemalloc", Napi::Function::New(env, _isUsingJemalloc));
  exports.Set("stats", Napi::Function::New(env, stats));
  return exports;
}

NODE_API_MODULE(sharp, init)
