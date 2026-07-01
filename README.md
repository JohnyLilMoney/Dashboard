# Booting my servers remotely
### Uses wol for boot and ssh for reboot, poweroff and status: uptime + offline/online/starting/unavailable (for dual boot systems that are booted into the other os).
If you need a very lightweight tool to boot your servers you can modify this to your needs. Backgrounds folder can be safely removed to make it even more lightweight (into kilobytes instead of megabytes)
I'm using tailscale with hardcoded ip adresses since they were all already on the same network and lately there is lots of network changes, could be configured for static ip's with port forwarding (at least port 22) on your end. The main purpose (wol) would be defeated but could stil be used for the rest of the functionality I guess.
Each server gets a hardcoded Details section here, you'd need to replace that with something that's relevant for your server.

### Setup instructions for when I forget how to add more servers
First set up ssh keys for access without password on a user (e.g. remoteadmin) and give that user permission to reboot and poweroff without sudo/credentials.
Then configure all the hardcoded stuff idk
//todo

### If you are using this code don't run it like this for a public website
Flask is fine for testing or if it's a private tool (only me and friends can access mine for example). Switch to something like nginx.

### Pro tip for ppl that don't read the code:
If you like a certain background you can get that one permanently by connecting with a slash and the name. Example for mine:
``` http://johnylilmoney.nl/campfire ```
