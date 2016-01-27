/**
 *  MQTT Bridge
 *
 * 	Authors
 *   - st.john.johnson@gmail.com
 *   - jeremiah.wuenschel@gmail.com
 *
 *  Copyright 2016
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 */
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

definition(
    name: "MQTT Bridge",
    namespace: "stj",
    author: "St. John Johnson and Jeremiah Wuenschel",
    description: "A bridge between SmartThings and MQTT",
    category: "My Apps",
    iconUrl: "https://s3.amazonaws.com/smartapp-icons/Connections/Cat-Connections.png",
    iconX2Url: "https://s3.amazonaws.com/smartapp-icons/Connections/Cat-Connections@2x.png",
    iconX3Url: "https://s3.amazonaws.com/smartapp-icons/Connections/Cat-Connections@3x.png"
)

preferences {
    section ("Input") {
        input "switches", "capability.switch", title: "Switches", multiple: true
        input "switchLevels", "capability.switchLevel", title: "Dimmers", multiple: true
        input "powerMeters", "capability.powerMeter", title: "Power Meters", multiple: true
    }

    section ("Bridge") {
        input "bridge", "capability.notification", title: "Notify this Bridge", required: true, multiple: false
    }
}

def installed() {
    log.debug "Installed with settings: ${settings}"

    initialize()
}

def updated() {
    log.debug "Updated with settings: ${settings}"

    unsubscribe()
    initialize()
}

// Return list of displayNames
def getDeviceNames(devices) {
    def list = []
    devices.each{device->
        list.push(device.displayName)
    }
    list
}

def initialize() {
    subscribe(powerMeters, "power", inputHandler)
    subscribe(switches, "switch", inputHandler)
    subscribe(switchLevels, "level", inputHandler)

    subscribe(bridge, "message", bridgeHandler)

    // Updating subscription
    def json = new groovy.json.JsonOutput().toJson([
        path: '/subscribe',
        body: [
            devices: [
                power: getDeviceNames(powerMeters),
                switch: getDeviceNames(switches),
                level: getDeviceNames(switchLevels)
            ]
        ]
    ])

    log.debug "Updating subscription: ${json}"

    bridge.deviceNotification(json)
}

def bridgeHandler(evt) {
    def json = new groovy.json.JsonOutput().toJson([
        deviceId: evt.deviceId,
      	name: evt.displayName,
        value: evt.value,
        type: evt.name,
        date: evt.isoDate
    ])

    log.debug "Receiving device event from bridge: ${json}"
}

def inputHandler(evt) {
    def json = new groovy.json.JsonOutput().toJson([
        path: '/push',
        body: [
            name: evt.displayName,
            value: evt.value,
            type: evt.name
        ]
    ])

    log.debug "Forwarding device event to bridge: ${json}"

    bridge.deviceNotification(json)
}
