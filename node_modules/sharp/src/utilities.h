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

#ifndef SRC_UTILITIES_H_
#define SRC_UTILITIES_H_

#include <napi.h>

Napi::Value cache(const Napi::CallbackInfo& info);
Napi::Value concurrency(const Napi::CallbackInfo& info);
Napi::Value counters(const Napi::CallbackInfo& info);
Napi::Value simd(const Napi::CallbackInfo& info);
Napi::Value libvipsVersion(const Napi::CallbackInfo& info);
Napi::Value format(const Napi::CallbackInfo& info);
Napi::Value _maxColourDistance(const Napi::CallbackInfo& info);
Napi::Value _isUsingJemalloc(const Napi::CallbackInfo& info);

#endif  // SRC_UTILITIES_H_
