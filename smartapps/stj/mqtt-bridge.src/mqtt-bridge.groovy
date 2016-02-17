/**
 *  MQTT Bridge
 *
 *  Authors
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
        input "switches", "capability.switch", title: "Switches", multiple: true, required: false
        input "levels", "capability.switchLevel", title: "Levels", multiple: true, required: false
        input "powerMeters", "capability.powerMeter", title: "Power Meters", multiple: true, required: false
        input "motionSensors", "capability.motionSensor", title: "Motion Sensors", multiple: true, required: false
        input "contactSensors", "capability.contactSensor", title: "Contact Sensors", multiple: true, required: false
        input "temperatureSensors", "capability.temperatureMeasurement", title: "Temperature Sensors", multiple: true, required: false
    }

    section ("Bridge") {
        input "bridge", "capability.notification", title: "Notify this Bridge", required: true, multiple: false
    }
}

def installed() {
    log.debug "Installed with settings: ${settings}"

    runEvery15Minutes(initialize)
    initialize()
}

def updated() {
    log.debug "Updated with settings: ${settings}"

    // Unsubscribe from all events
    unsubscribe()
    // Subscribe to stuff
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
    // Subscribe to new events from devices
    subscribe(powerMeters, "power", inputHandler)
    subscribe(motionSensors, "motion", inputHandler)
    subscribe(switches, "switch", inputHandler)
    subscribe(levels, "level", inputHandler)
    subscribe(contactSensors, "contact", inputHandler)
    subscribe(temperatureSensors, "temperature", inputHandler)  

    // Subscribe to events from the bridge
    subscribe(bridge, "message", bridgeHandler)

    // Update the bridge
    updateSubscription()
}

// Update the bridge's subscription
def updateSubscription() {
    def json = new groovy.json.JsonOutput().toJson([
        path: '/subscribe',
        body: [
            devices: [
                power: getDeviceNames(powerMeters),
                motion: getDeviceNames(motionSensors),
                switch: getDeviceNames(switches),
                level: getDeviceNames(levels),
                contact: getDeviceNames(contactSensors),
                temperature: getDeviceNames(temperatureSensors)
            ]
        ]
    ])

    log.debug "Updating subscription: ${json}"

    bridge.deviceNotification(json)
}

// Receive an event from the bridge
def bridgeHandler(evt) {
    def json = new JsonSlurper().parseText(evt.value)

    switch (json.type) {
        case "power":
        case "contact":
        case "temperature":
        case "motion":
            // Do nothing, we can change nothing here
            break
        case "switch":
            switches.each{device->
                if (device.displayName == json.name) {
                    if (json.value == 'on') {
                        device.on();
                    } else {
                        device.off();
                    }
                }
            }
            break
        case "level":
            levels.each{device->
                if (device.displayName == json.name) {
                    device.setLevel(json.value);
                }
            }
            break
    }

    log.debug "Receiving device event from bridge: ${json}"
}

// Receive an event from a device
def inputHandler(evt) {
    def json = new JsonOutput().toJson([
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
