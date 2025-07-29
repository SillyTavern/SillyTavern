git --version
git pull --rebase --autostash
echo "Installing Node Modules..."
export NODE_ENV=production
npm install --no-audit --no-fund --loglevel=error --no-progress --omit=dev
echo "Entering SillyTavern..."
node "server.js" "$@"
