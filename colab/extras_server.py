import os
import time
import subprocess
import globals

def runServer():
    cmd = f"python server.py {' '.join(globals.params)}"
    print(cmd)
    extras_process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd='/TavernAI-extras', shell=True)
    print('processId:', extras_process.pid)
    while True:
        line = extras_process.stdout.readline().decode().strip()
        if "Running on " in line:
            break
        if not line:
            print('breaking on line')
            break
        print(line)


def extractUrl():
    subprocess.call(
        'nohup lt --port 5100 > ./extras.out 2> ./extras.err &', shell=True)
    print('Waiting for lt init...')
    time.sleep(5)
    while True:
        if (os.path.getsize('./extras.out') > 0):
            with open('./extras.out', 'r') as f:
                lines = f.readlines()
            for x in range(len(lines)):
                if ('your url is: ' in lines[x]):
                    print('TavernAI Extensions URL:')
                    globals.extras_url = lines[x].split('your url is: ')[1]
                    print(globals.extras_url)
            break
        if (os.path.getsize('./extras.err') > 0):
            with open('./extras.err', 'r') as f:
                print(f.readlines())
                break
