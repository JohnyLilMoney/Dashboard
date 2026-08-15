View the tool yourself on ```johnylilmoney.nl```.
# Booting my servers remotely
Keeping my servers running is a waste of power, but if I need them while I am away (or friends do) having a family member go and press a button is far from an ideal solution. This runs on a smaller server of about 6 watts instead, and gives detailed info + controls.
### Uses wol for boot and ssh for reboot, poweroff and status: uptime + offline/online/starting/unavailable (for dual boot systems that are booted into the other os).
If you need a lightweight tool to boot your servers you can modify this to your needs. Things to note:
1. Backgrounds folder can be safely removed to make it even more lightweight (into kilobytes instead of megabytes)
2. I'm using tailscale with hardcoded ip adresses since they were all already on the same network and lately there is lots of network changes, could be configured for static ip's with port forwarding (at least port 22) on your end. The main purpose (wol) would be defeated but could stil be used for the rest of the functionality I guess.
3. Each server gets a hardcoded "Details" section here, you'd need to replace that with something that's relevant for your server.
4. Current code adds passwords to boot unless users are connected over tailscale. You can remove the authentication if it is not accessible publicly.

### Some setup instructions
1. On the webserver you need to pip install flask (if it's for private use) and requests, with this version also mcstatus (but that depends on what's shown in the details).
2. (optional, strongly recommended for public sites) Get a WSGI server in between, depending on the setup with nginx in front of it as well. Make sure you use 1 worker (gunicorn, whatever the equivalent is called on your wsgi), because the cached values are stored in memory and each gets their own memory. Here are my arguments:
```command_args="-w 1 -k gevent --worker-connections 100 -b 127.0.0.1:8000 --timeout 30 app:app```
3. Per server:
- First set up ssh keys for access without password on a user (e.g. remoteadmin) and give that user permission to reboot and poweroff without credentials.
- Match ip's/ports/etc in app.py
- Then configure all the hardcoded which depends on what kind of server it is and what info you want to display.

### Some features you might want to know:
1. Custom welcome messages (TailScale user exclusive)
2. If you like a certain background you can use that one permanently by connecting with a slash and the name. Example for mine:
``` https://johnylilmoney.nl/night ```
Or the other way around
```https://johnylilmoney.nl/?exclude=campfire```
(get the background's name by pressing the info button)
3. If the UI disappears, you accidentally pressed that link (I sometimes use this in my background engine but don't the ui visible), presss the info button again (still in the bottom right even though you can't see it anymore).
4. Coming soon: like/dislike system for when I add more backgrounds so you can influence how often you get them (could be useful when I add a lot more backgrounds
