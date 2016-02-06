# SmartThings MQTT Bridge
***System to share and control SmartThings device states in MQTT.***

[![GitHub tag](https://img.shields.io/github/tag/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://github.com/stjohnjohnson/smartthings-mqtt-bridge/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://hub.docker.com/r/stjohnjohnson/smartthings-mqtt-bridge/)
[![Docker Stars](https://img.shields.io/docker/stars/stjohnjohnson/smartthings-mqtt-bridge.svg)](https://hub.docker.com/r/stjohnjohnson/smartthings-mqtt-bridge/)

This project was spawned by the desire to [control SmartThings from within Home Assistant][ha-issue].  Since Home Assistant already supports MQTT, we chose to go and build a bridge between SmartThings and MQTT.

# Architecture

![Architecture](https://www.websequencediagrams.com/cgi-bin/cdraw?lz=dGl0bGUgU21hcnRUaGluZ3MgPC0-IE1RVFQgCgpwYXJ0aWNpcGFudCBaV2F2ZSBMaWdodAoKAAcGTW90aW9uIERldGVjdG9yLT5TVCBIdWI6ABEIRXZlbnQgKFotV2F2ZSkKABgGACEFTVFUVEJyaWRnZSBBcHA6IERldmljZSBDaGFuZ2UAMAhHcm9vdnkAMwUAIg4AMxAAOAY6IE1lc3NhADYKSlNPTgAuEABjBi0-AHYLU2VyADkGAHAVUkVTVCkKAB0SAD0GIEJyb2tlcgCBaQk9IHRydWUgKE1RVFQpCgAyBQAcBwBdFgCCSgUgPSAib24iAC4IAFgUAIFaFgCBFhsAgWAWAIJnEwCCESMAgmoIAINWBVR1cm4AgTAHT24AgxcNAINXBQCEGwsAgVYIT24Ag3oJ&s=default)

# MQTT Events

Events about a device (power, level, switch) are sent to MQTT using the following format:

```
/SmartThings/{DEVICE_NAME}/${ATTRIBUTE}
```

For example, my Dimmer Z-Wave Lamp is called "Fireplace Lights" in SmartThings.  The following topics are published:

```
# Brightness (0-99)
/SmartThings/Fireplace Lights/level
# Switch State (on|off)
/SmartThings/Fireplace Lights/switch
```

The Bridge also subscribes to changes in these topics, so that you can update the device via MQTT.

```
$ mqtt pub -t '/SmartThings/Fireplace Lights/switch'  -m 'off'
# Light goes off in SmartThings
```

# Configuration

The bridge has one yaml file for configuration.  Currently we only have one item you can set:

```
---
mqtt:
  host: 192.168.1.200
```

We'll be adding additional fields as this service progresses (port, username, password, etc).

# Usage

1. Run the Docker container

    ```
    $ docker run \
        -d \
        --name="mqtt-bridge" \
        -v /opt/mqtt-bridge:/config \
        -p 8080:8080 \
        stjohnjohnson/smartthings-mqtt-bridge
    ```
2. Customize the MQTT host

    ```
    $ vi /opt/mqtt-bridge/config.yml
    $ docker restart mqtt-bridge
    ```
3. Install the [Device Type][dt] on the [Device Handler IDE][ide-dt]
4. Configure the Device Type (via the IDE) with the IP Address, Port, and MAC Address of the machine running the Docker container
5. Install the [Smart App][app] on the [Smart App IDE][ide-app]
6. Configure the Smart App (via the Native App) with the devices you want to share and the Device Handler you just installed as the bridge
7. Watch as MQTT is populated with events from your devices

## Docker Compose

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

 [dt]: https://github.com/stjohnjohnson/smartthings-mqtt-bridge/blob/master/devicetypes/stj/mqtt-bridge.src/mqtt-bridge.groovy
 [app]: https://github.com/stjohnjohnson/smartthings-mqtt-bridge/blob/master/smartapps/stj/mqtt-bridge.src/mqtt-bridge.groovy
 [ide-dt]: https://graph.api.smartthings.com/ide/devices
 [ide-app]: https://graph.api.smartthings.com/ide/apps
 [ha-issue]: https://github.com/balloob/home-assistant/issues/604
 [docker-compose]: https://docs.docker.com/compose/
