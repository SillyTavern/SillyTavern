#include <jni.h>
#include <string>
#include <cstdlib>
#include <pthread.h>
#include <unistd.h>
#include <android/log.h>

#include "node.h"

#define APPNAME "SillyTavern-Node"

static JavaVM* cacheJavaVM = NULL;
static jobject cacheMainActivity = NULL;

int pipe_stdout[2];
int pipe_stderr[2];
pthread_t thread_stdout;
pthread_t thread_stderr;

void *thread_stderr_func(void*) {
    ssize_t redirect_size;
    char buf[2048];
    while ((redirect_size = read(pipe_stderr[0], buf, sizeof buf - 1)) > 0) {
        if (buf[redirect_size - 1] == '\n')
            --redirect_size;
        buf[redirect_size] = 0;
        __android_log_write(ANDROID_LOG_ERROR, APPNAME, buf);
    }
    return 0;
}

void *thread_stdout_func(void*) {
    ssize_t redirect_size;
    char buf[2048];
    while ((redirect_size = read(pipe_stdout[0], buf, sizeof buf - 1)) > 0) {
        if (buf[redirect_size - 1] == '\n')
            --redirect_size;
        buf[redirect_size] = 0;
        __android_log_write(ANDROID_LOG_INFO, APPNAME, buf);
    }
    return 0;
}

int start_redirecting_stdout_stderr() {
    setvbuf(stdout, 0, _IONBF, 0);
    pipe(pipe_stdout);
    dup2(pipe_stdout[1], STDOUT_FILENO);
    setvbuf(stderr, 0, _IONBF, 0);
    pipe(pipe_stderr);
    dup2(pipe_stderr[1], STDERR_FILENO);
    if (pthread_create(&thread_stdout, 0, thread_stdout_func, 0) == -1)
        return -1;
    pthread_detach(thread_stdout);
    if (pthread_create(&thread_stderr, 0, thread_stderr_func, 0) == -1)
        return -1;
    pthread_detach(thread_stderr);
    return 0;
}

static pthread_t node_thread;
static char** node_argv = NULL;

void *node_thread_func(void *arg) {
    start_redirecting_stdout_stderr();

    int argc = 0;
    char **argv = (char**)arg;

    while (argv[argc] != NULL) argc++;

    __android_log_print(ANDROID_LOG_INFO, APPNAME, "Starting Node.js with %d args", argc);
    for (int i = 0; i < argc; i++) {
        __android_log_print(ANDROID_LOG_INFO, APPNAME, "  argv[%d] = %s", i, argv[i]);
    }

    int exit_code = node::Start(argc, argv);
    __android_log_print(ANDROID_LOG_INFO, APPNAME, "Node.js exited with code %d", exit_code);

    JNIEnv *env;
    bool attached = false;
    if (cacheJavaVM->GetEnv((void**)&env, JNI_VERSION_1_6) == JNI_EDETACHED) {
        cacheJavaVM->AttachCurrentThread(&env, NULL);
        attached = true;
    }

    if (cacheMainActivity != NULL && env != NULL) {
        jclass cls = env->GetObjectClass(cacheMainActivity);
        if (cls != NULL) {
            jmethodID mid = env->GetMethodID(cls, "onNodeExited", "(I)V");
            if (mid != NULL) {
                env->CallVoidMethod(cacheMainActivity, mid, (jint)exit_code);
            }
        }
    }

    if (attached) {
        cacheJavaVM->DetachCurrentThread();
    }

    for (int i = 0; argv[i] != NULL; i++) {
        free(argv[i]);
    }
    free(argv);

    return NULL;
}

extern "C"
JNIEXPORT void JNICALL
Java_ai_sillytavern_app_NodeRuntime_startNodeWithArguments(
        JNIEnv *env,
        jobject thiz,
        jobjectArray arguments,
        jstring appRootPath,
        jstring dataDirPath) {

    const char* nativeAppRoot = env->GetStringUTFChars(appRootPath, 0);
    const char* nativeDataDir = env->GetStringUTFChars(dataDirPath, 0);

    setenv("NODE_ENV", "production", 1);
    setenv("HOME", nativeDataDir, 1);
    setenv("DATA_ROOT", nativeDataDir, 1);
    setenv("SILLYTAVERN_BROWSERLAUNCH_ENABLED", "false", 1);
    setenv("SILLYTAVERN_WHITELISTMODE", "false", 1);
    setenv("SILLYTAVERN_DISABLECSRF", "true", 1);

    char node_path[1024];
    snprintf(node_path, sizeof(node_path), "%s/node_modules", nativeAppRoot);
    setenv("NODE_PATH", node_path, 1);

    __android_log_print(ANDROID_LOG_INFO, APPNAME, "NODE_PATH=%s", node_path);
    __android_log_print(ANDROID_LOG_INFO, APPNAME, "DATA_ROOT=%s", nativeDataDir);

    jsize arg_count = env->GetArrayLength(arguments);

    char** argv = (char**)calloc(arg_count + 1, sizeof(char*));
    for (int i = 0; i < arg_count; i++) {
        const char* arg = env->GetStringUTFChars((jstring)env->GetObjectArrayElement(arguments, i), 0);
        argv[i] = strdup(arg);
        env->ReleaseStringUTFChars((jstring)env->GetObjectArrayElement(arguments, i), arg);
    }
    argv[arg_count] = NULL;

    env->GetJavaVM(&cacheJavaVM);
    cacheMainActivity = env->NewGlobalRef(thiz);

    pthread_create(&node_thread, NULL, node_thread_func, (void*)argv);
    pthread_detach(node_thread);

    env->ReleaseStringUTFChars(appRootPath, nativeAppRoot);
    env->ReleaseStringUTFChars(dataDirPath, nativeDataDir);
}

