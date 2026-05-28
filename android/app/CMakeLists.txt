cmake_minimum_required(VERSION 3.4.1)

add_library(
    sillytavern-node
    SHARED
    src/main/cpp/native-lib.cpp
)

include_directories(${CMAKE_SOURCE_DIR}/libnode/include/node/)

add_library(
    libnode
    SHARED
    IMPORTED
)

set_target_properties(
    libnode
    PROPERTIES IMPORTED_LOCATION
    ${CMAKE_SOURCE_DIR}/libnode/bin/${ANDROID_ABI}/libnode.so
)

find_library(log-lib log)

target_link_libraries(
    sillytavern-node
    libnode
    ${log-lib}
)
