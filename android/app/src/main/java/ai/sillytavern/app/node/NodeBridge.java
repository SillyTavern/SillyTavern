package ai.sillytavern.app.node;

public class NodeBridge {
    static {
        System.loadLibrary("node");
    }

    private static boolean started = false;

    public static native int startNode(String[] args);

    public static native void stopNode();

    public static boolean isStarted() {
        return started;
    }

    public static void setStarted(boolean val) {
        started = val;
    }
}
