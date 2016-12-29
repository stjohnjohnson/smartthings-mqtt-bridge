# SmartThings MQTT Bridge
***System to share and control SmartThings device states in MQTT.***

[![GitHub Tag](https://img.shields.io/github/tag/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://github.com/stjohnjohnson/smartthings-mqtt-bridge/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://hub.docker.com/r/stjohnjohnson/smartthings-mqtt-bridge/)
[![Docker Stars](https://img.shields.io/docker/stars/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://hub.docker.com/r/stjohnjohnson/smartthings-mqtt-bridge/)
[![Wercker Status](https://app.wercker.com/status/f2df197ea40f89b7eda771e67b4a4e1e/s/master "wercker status")](https://app.wercker.com/project/bykey/f2df197ea40f89b7eda771e67b4a4e1e)
[![Gitter](https://badges.gitter.im/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://gitter.im/stjohnjohnson/smartthings-mqtt-bridge?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
[![Donate](https://img.shields.io/badge/donate-bitcoin-yellow.svg)](#donate)

This project was spawned by the desire to [control SmartThings from within Home Assistant][ha-issue].  Since Home Assistant already supports MQTT, we chose to go and build a bridge between SmartThings and MQTT.

# Architecture

![Architecture](https://www.websequencediagrams.com/cgi-bin/cdraw?lz=dGl0bGUgU21hcnRUaGluZ3MgPC0-IE1RVFQgCgpwYXJ0aWNpcGFudCBaV2F2ZSBMaWdodAoKAAcGTW90aW9uIERldGVjdG9yLT5TVCBIdWI6ABEIRXZlbnQgKFotV2F2ZSkKABgGACEFTVFUVEJyaWRnZSBBcHA6IERldmljZSBDaGFuZ2UAMAhHcm9vdnkAMwUAIg4AMxAAOAY6IE1lc3NhADYKSlNPTgAuEABjBi0-AHYLU2VyADkGAHAVUkVTVCkKAB0SAD0GIEJyb2tlcgCBaQk9IHRydWUgKE1RVFQpCgAyBQAcBwBdFgCCSgUgPSAib24iAC4IAFgUAIFaFgCBFhsAgWAWAIJnEwCCESMAgmoIAINWBVR1cm4AgTAHT24AgxcNAINXBQCEGwsAgVYIT24Ag3oJ&s=default)

# MQTT Events

Events about a device (power, level, switch) are sent to MQTT using the following format:

```
{PREFACE}/{DEVICE_NAME}/${ATTRIBUTE}
```
__PREFACE is defined as "smartthings" by default in your configuration__

For example, my Dimmer Z-Wave Lamp is called "Fireplace Lights" in SmartThings.  The following topics are published:

```
# Brightness (0-99)
smartthings/Fireplace Lights/level
# Switch State (on|off)
smartthings/Fireplace Lights/switch
```

The Bridge also subscribes to changes in these topics, so that you can update the device via MQTT.

```
$ mqtt pub -t 'smartthings/Fireplace Lights/switch'  -m 'off'
# Light goes off in SmartThings
```

# Configuration

The bridge has one yaml file for configuration:

```
---
mqtt:
    # Specify your MQTT Broker URL here
    host: mqtt://localhost
    # Example from CloudMQTT
    # host: mqtt:///m10.cloudmqtt.com:19427

    # Preface for the topics $PREFACE/$DEVICE_NAME/$PROPERTY
    preface: smartthings

    # Suffix for the state topics $PREFACE/$DEVICE_NAME/$PROPERTY/$STATE_SUFFIX
    # state_suffix: state
    # Suffix for the command topics $PREFACE/$DEVICE_NAME/$PROPERTY/$COMMAND_SUFFIX
    # command_suffix: cmd

    # Other optional settings from https://www.npmjs.com/package/mqtt#mqttclientstreambuilder-options
    # username: AzureDiamond
    # password: hunter2

# Port number to listen on
port: 8080

```

# Installation

There are two ways to use this, Docker (self-contained) or NPM (can run on Raspberry Pi).

## Docker

Docker will automatically download the image, but you can "install" it or "update" it via `docker pull`:
```
$ docker pull stjohnjohnson/smartthings-mqtt-bridge
```

To run it (using `/opt/mqtt-bridge` as your config directory and `8080` as the port):
```
$ docker run \
    -d \
    --name="mqtt-bridge" \
    -v /opt/mqtt-bridge:/config \
    -p 8080:8080 \
    stjohnjohnson/smartthings-mqtt-bridge
```

To restart it:
```
$ docker restart mqtt-bridge
```

## NPM

To install the module, just use `npm`:
```
$ npm install -g smartthings-mqtt-bridge
```

If you want to run it, you can simply call the binary:
```
$ smartthings-mqtt-bridge
Starting SmartThings MQTT Bridge - v1.1.3
Loading configuration
No previous configuration found, creating one
```

Although we recommend using a process manager like [PM2][pm2]:
```
$ pm2 start smartthings-mqtt-bridge
[PM2] Starting smartthings-mqtt-bridge in fork_mode (1 instance)
[PM2] Done.
┌─────────────────────────┬────┬──────┬───────┬────────┬─────────┬────────┬────────────┬──────────┐
│ App name                │ id │ mode │ pid   │ status │ restart │ uptime │ memory     │ watching │
├─────────────────────────┼────┼──────┼───────┼────────┼─────────┼────────┼────────────┼──────────┤
│ smartthings-mqtt-bridge │ 1  │ fork │ 20715 │ online │ 0       │ 0s     │ 7.523 MB   │ disabled │
└─────────────────────────┴────┴──────┴───────┴────────┴─────────┴────────┴────────────┴──────────┘

$ pm2 logs smartthings-mqtt-bridge
smartthings-mqtt-bridge-1 (out): info: Starting SmartThings MQTT Bridge - v1.1.3
smartthings-mqtt-bridge-1 (out): info: Loading configuration
smartthings-mqtt-bridge-1 (out): info: No previous configuration found, creating one

$ pm2 restart smartthings-mqtt-bridge
```

## Usage
1. Customize the MQTT host
    ```
    $ vi config.yml
    # Restart the service to get the latest changes
    ```

2. Install the [Device Handler][dt] in the [Device Handler IDE][ide-dt] using "Create via code"
3. Add the "MQTT Device" device in the [My Devices IDE][ide-mydev]. Enter MQTT Device (or whatever) for the name. Select "MQTT Bridge" for the type. The other values are up to you.
4. Configure the "MQTT Device" in the [My Devices IDE][ide-mydev] with the IP Address, Port, and MAC Address of the machine running the Docker container
4. Install the [Smart App][app] on the [Smart App IDE][ide-app] using "Create via code"
5. Configure the Smart App (via the Native App) with the devices you want to share and the Device Handler you just installed as the bridge
6. Via the Native App, select your MQTT device and watch as MQTT is populated with events from your devices

## Advanced
### Docker Compose

If you want to bundle everything together, you can use [Docker Compose][docker-compose].

Just create a file called `docker-compose.yml` with this contents:
```yaml
mqtt:
    image: matteocollina/mosca
    ports:
        - 1883:1883

mqttbridge:
    image: stjohnjohnson/smartthings-mqtt-bridge
    volumes:
        - ./mqtt-bridge:/config
    ports:
        - 8080:8080
    links:
        - mqtt

homeassistant:
    image: balloob/home-assistant
    ports:
        - 80:80
    volumes:
        - ./home-assistant:/config
        - /etc/localtime:/etc/localtime:ro
    links:
        - mqtt
```

This creates a directory called `./mqtt-bridge/` to store configuration for the bridge.  It also creates a directory `./home-assistant` to store configuration for HA.

## Donate

If you use and love our bridge tool, please consider buying us a coffee by sending some Satoshi to `1sBPcBai7gZco6LipPthuyZ5rH4RKx1Bg`.

[![Donate Bitcoin](http://i.imgur.com/VJomBaC.png)](https://coinbase.com/stjohn)

 [dt]: https://github.com/stjohnjohnson/smartthings-mqtt-bridge/blob/master/devicetypes/stj/mqtt-bridge.src/mqtt-bridge.groovy
 [app]: https://github.com/stjohnjohnson/smartthings-mqtt-bridge/blob/master/smartapps/stj/mqtt-bridge.src/mqtt-bridge.groovy
 [ide-dt]: https://graph.api.smartthings.com/ide/devices
 [ide-mydev]: https://graph.api.smartthings.com/device/list
 [ide-app]: https://graph.api.smartthings.com/ide/apps
 [ha-issue]: https://github.com/balloob/home-assistant/issues/604
 [docker-compose]: https://docs.docker.com/compose/
 [pm2]: http://pm2.keymetrics.io/
