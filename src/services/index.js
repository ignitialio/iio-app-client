import Vue from 'vue'
import * as d3 from 'd3'
import { EventEmitter } from 'events'

import utils from '../utils'

export default class Services extends EventEmitter {
  constructor(socket) {
    super()

    this.socket = socket
    this.uuid = Math.random().toString(36).slice(2)

    // services dico (by name)
    this.servicesDico = {}

    // timeout
    this.rpcTimeout = 5000
  }

  initialize() {
    // event service:up means a new unified service available
    this.socket.on('service:up', service => {
      if (service) {
        // register each method for further call
        for (let i = 0; i < service.methods.length; i++) {
          this.register(service.name, service.methods[i])
        }

        this.servicesDico[service.name] = service

        if (service.options && service.options.uiComponentInjection) {
          let all = []
          let baseUrl = '/api/services/' + service.name + '/'
          let imagesBaseUrl = '/api/images/' + service.name + '/'

          let jsURL = baseUrl + 'build.js'
          let jsChunksURL = baseUrl + 'chunks.js'
          let cssURL = baseUrl + 'build.css'

          this.servicesDico[service.name].baseUrl = baseUrl
          this.servicesDico[service.name].imagesBaseUrl = baseUrl
          this.servicesDico[service.name].options.description.icon =
            imagesBaseUrl +
            this.servicesDico[service.name].options.description.icon

          // effective load
          // no need to check for css (to be removed in v5)
          utils.loadAsync(cssURL, 'css').then(added => {
            this.servicesDico[service.name].domElements =
              this.servicesDico[service.name].domElements || []

            for (let a of added) {
              this.servicesDico[service.name].domElements.push(a)
            }
          }).catch(err => {
            console.log('webpack or css not available')
          })

          let loadMainJS = () => {
            return new Promise((resolve, reject) => {
              utils.loadAsync(jsURL, 'js').then(async added => {
                console.log(service.name + ': async services main file loaded with id ' + added)

                this.servicesDico[service.name].ready = true
                this.servicesDico[service.name].domElements =
                  this.servicesDico[service.name].domElements || []

                for (let a of added) {
                  this.servicesDico[service.name].domElements.push(a)
                }

                // tells locally (client side) that a service is up
                utils.waitForProperty(this, '$i18n').then($i18n => {
                  // translations
                  $i18n.addTranslations(
                    this.servicesDico[service.name].options.description.i18n)
                })

                global['service_' + service.name](Vue)

                this.emit('service:up', service)
                resolve()
              }).catch(err => reject(err))
            })
          }

          utils.loadAsync(jsChunksURL, 'js').then(added => {
            console.log(service.name + ': async services chunk file loaded with id ' + added)
            this.servicesDico[service.name].domElements =
              this.servicesDico[service.name].domElements || []

            for (let a of added) {
              this.servicesDico[service.name].domElements.push(a)
            }

            loadMainJS()
          }).catch(err => {
            console.log('no chunks for service ' +  service.name, err, jsChunksURL)
            loadMainJS()
          })
        } else {
          this.servicesDico[service.name].ready = true
          // tells locally (client side) that a service is up
          this.emit('service:up', service)
        }
      }

      // heartbeat
      this.heartbeat = true
    })

    // a service has been shut down
    this.socket.on('service:down', service => {
      // send event before destroying data
      this.emit('service:down', service.name, this.servicesDico[service.name])

      // if dom elements, then remove
      if (this.servicesDico[service.name].domElements) {
        for (let domElId of this.servicesDico[service.name].domElements) {
          d3.select('#' + domElId).remove()
        }
      }

      // deletes registered reference
      delete this[service.name]
      delete this.servicesDico[service.name]
    })

    // heartbeat
    this.heartbeat = true
  }

  register(service, method) {
    this[service] = this[service] || {}

    this[service][method] = args => {
      return new Promise((resolve, reject) => {
        let token = Math.random().toString(36).slice(2)
        let topic = 'service:' + service + ':' + method + ':' + token

        let timeout = setTimeout(() => {
          this.socket.off(topic)
          reject(new Error('timeout for ' + topic))
        }, this.rpcTimeout)

        this.socket.once(topic, data => {
          clearTimeout(timeout)
          if (data.err) {
            reject(data.err)
          } else {
            resolve(data.result)
          }

          // heartbeat
          this.heartbeat = true
        })

        // 2018/08/15: tokenized userID
        let fullArgs = {
          args: args,
          token: token,
          method: method,
          userId: localStorage.token
        }

        this.socket.emit('service:' + service + ':request', fullArgs)
      })
    }
  }

  waitForProperty(obj, prop, delay) {
    return new Promise((resolve, reject) => {
      var checkTimeout

      var checkInterval = setInterval(() => {
        if (obj[prop]) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(obj[prop])
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          reject(new Error('Timeout: property ' + prop + ' is not available'))
        }
      }, delay || 5000)
    })
  }

  waitForService(name, delay) {
    return new Promise((resolve, reject) => {
      var checkTimeout

      var checkInterval = setInterval(() => {
        if (this[name]) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(this[name])
        }
      }, 100)

      if (delay !== 0) {
        checkTimeout = setTimeout(() => {
          if (checkInterval) {
            clearInterval(checkInterval)
            reject(new Error('Timeout: service ' + name + ' is not available'))
          }
        }, delay || 5000)
      }
    })
  }

  waitForServiceProperty(name, property, delay) {
    return new Promise((resolve, reject) => {
      var checkTimeout

      var checkInterval = setInterval(() => {
        if (this[name] && this[name][property]) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(this[name][property])
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          reject(new Error('Timeout: service ' + name + '\'s property ' + property + ' is not available'))
        }
      }, delay || 5000)
    })
  }
}
