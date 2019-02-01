## Setting up

### Windows

Set registry value `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\MaxUserPort` to something like `60000`.

Add `--max-old-space-size=4096` parameter to `C:\Users\{Username}\AppData\Roaming\npm\artillery.cmd`, so it looks like `node --max-old-space-size=4096 "%~dp0\node_modules\artillery\bin\artillery" %*`. The value is specified in megabytes.

### Ubuntu 18.04

NodeJs version 10.x or higher is required.
https://askubuntu.com/questions/426750/how-can-i-update-my-nodejs-to-the-latest-version

```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Troubleshooting

### Windows

NodeJs (npm) package location - `C:\Users\{Username}\AppData\Roaming\npm\node_modules\artillery\`.

It seems like NodeJs only uses `49152 – 65535` ports range (16 thousands) for TCP connections.
Execute `taskkill /im node.exe /f` to free up those ports.

### Ubuntu 18.04

NodeJs (npm) package location - `/usr/local/lib/node_modules/artillery`.

Check current number of open connections - [express socket io - “connect EMFILE” error in Node.js](https://code.i-harness.com/en/q/9e032d).

```
lsof | grep node | wc -l
```

Check process IDs.

```
lsof -i
```

Copy `engine_palindrom.js` to the output folder.

```
sudo cp ~/Documents/GitHub/Playground/artillery.io/core/lib/engine_palindrom.js /usr/local/lib/node_modules/artillery/core/lib/engine_palindrom.js
```