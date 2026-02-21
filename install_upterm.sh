ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize architecture names to match upterm release naming
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  armv7l)  ARCH="armv6" ;;
  i386|i686) ARCH="386" ;;
esac

# Normalize OS names
case "$OS" in
  darwin)  OS="darwin" ;;
  linux)   OS="linux" ;;
  *)       echo "Unsupported OS: $OS"; exit 1 ;;
esac

TARBALL="upterm_${OS}_${ARCH}.tar.gz"
echo "Downloading: $TARBALL"

mkdir upterm
cd upterm
curl -L "https://github.com/owenthereal/upterm/releases/latest/download/${TARBALL}" -o upterm.tar.gz
tar -xzf upterm.tar.gz
sudo mkdir -p /usr/local/bin
sudo mv upterm /usr/local/bin/
sudo chmod +x /usr/local/bin/upterm
cd ..
rm -rf upterm
upterm version
