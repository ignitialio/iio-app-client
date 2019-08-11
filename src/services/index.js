import * as d3 from 'd3'

import { EventEmitter } from 'events'
import Encoders from '../encoders'

import utils from '../utils'

export default class Services extends EventEmitter {
  constructor(socket, encoder = 'bson') {
    super()

    this.socket = socket
    this.uuid = utils.uuid()

    // services dico (by name)
    this.servicesDico = {}

    // timeout
    this._rpcTimeout = 5000

    // encoder
    this._encoder = Encoders[encoder]
  }

  get rpcTimeout() {
    return this. _rpcTimeout
  }

  set rpcTimeout(val) {
    this._rpcTimeout = val || this._rpcTimeout
  }

  /* initialize Services passing a framework reference (for ex: Vue) */
  initialize(framework) {
    // event service:up means a new unified service available
    this.socket.on('service:up', service => {
      if (service) {
        // decode/unpack
        service = this._encoder.unpack(service)

        // register each method for further call
        for (let i = 0; i < service.methods.length; i++) {
          this.register(service.name, service.methods[i])
        }

        this.servicesDico[service.name] = service

        if (service.options && service.options.uiComponentInjection) {
          // effective load
          // no need to check for css (to be removed in v5)
          this.loadAsync(service.name, 'build.css', 'css').then(added => {
            this.servicesDico[service.name].domElements =
              this.servicesDico[service.name].domElements || []

            this.servicesDico[service.name].domElements.push(added)
          }).catch(err => {
            console.log('css not available for service ' + service.name, '' + err)
          })

          let loadMainJS = () => {
            return new Promise((resolve, reject) => {
              this.loadAsync(service.name, 'build.js', 'js').then(async added => {
                this.servicesDico[service.name].ready = true
                this.servicesDico[service.name].domElements =
                  this.servicesDico[service.name].domElements || []

                this.servicesDico[service.name].domElements.push(added)

                // tells locally (client side) that a service is up
                utils.waitForProperty(this, '$i18n').then($i18n => {
                  // translations
                  $i18n.addTranslations(
                    this.servicesDico[service.name].options.description.i18n)
                })

                // call main service client (browser) function
                global['iios_' + service.name](framework)

                this.emit('service:up', service)
                resolve()
              }).catch(err => reject(err))
            })
          }

          this.loadAsync(service.name, 'chunks.js', 'js').then(added => {
            this.servicesDico[service.name].domElements =
              this.servicesDico[service.name].domElements || []

            this.servicesDico[service.name].domElements.push(added)

            loadMainJS().catch(err => console.log(err))
          }).catch(err => {
            console.log('no chunks for service ' + service.name, '' + err)
            loadMainJS().catch(err => console.log(err))
          })
        } else {
          this.servicesDico[service.name].ready = true
          // tells locally (client side) that a service is up
          this.emit('service:up', service)
        }
      }
    })

    // a service has been shut down
    this.socket.on('service:down', service => {
      // decode/unpack
      service = this._encoder.unpack(service)

      let onReadyToBeRemove = () => {
        clearTimeout(destroyTimeout)

        // if dom elements, then remove
        if (this.servicesDico[service.name].domElements) {
          for (let domElId of this.servicesDico[service.name].domElements) {
            d3.select('#' + domElId).remove()
          }
        }

        // deletes registered reference
        delete this[service.name]
        delete this.servicesDico[service.name]

        // send event before destroying data
        this.emit('service:down', service.name, this.servicesDico[service.name])
      }

      // destroy automatically if no request for that
      let destroyTimeout = setTimeout(onReadyToBeRemove, 3000)

      this.once('service:destroy:' + service.name + ':done', onReadyToBeRemove)
      this.emit('service:destroy:' + service.name)
    })
  }

  register(service, method) {
    this[service] = this[service] || {}

    this[service][method] = (...args) => {
      return new Promise((resolve, reject) => {
        let token = Math.random().toString(36).slice(2)
        let topic = 'service:' + service + ':' + method + ':' + token

        let timeout = setTimeout(() => {
          this.socket.off(topic)
          reject(new Error('timeout for ' + topic))
        }, this.rpcTimeout)

        this.socket.once(topic, response => {
          clearTimeout(timeout)
          if (response.err) {
            reject(response.err)
          } else {
            // decode/unpack
            let data = (this._encoder.unpack(response)).data
            resolve(data)
          }
        })

        // send jwt for user id retrieval
        let fullArgs = {
          args: args,
          token: token,
          method: method,
          jwt: localStorage.getItem('token')
        }

        this.socket.emit('service:' + service + ':request',
          this._encoder.pack(fullArgs))
      })
    }
  }

  getFileFromService(serviceName, fileName) {
    return new Promise((resolve, reject) => {
      let token = utils.uuid()
      let topic = 'service:proxy:' + token

      let timeout = setTimeout(() => {
        this.socket.off(topic)
        reject(new Error('timeout for ' + topic))
      }, this.rpcTimeout * 20)

      this.socket.once(topic, data => {
        clearTimeout(timeout)
        if (data.err) {
          reject(data.err)
        } else {
          resolve(data)
        }
      })

      this.socket.emit('service:proxy', serviceName, fileName, token)
    })
  }

  loadAsync(serviceName, fileName, whichKind) {
    return new Promise((resolve, reject) => {
      this.getFileFromService(serviceName, fileName).then(data => {
        // conversion to string
        data = String.fromCharCode.apply(null, new Uint8Array(data))

        let uid = 'iios_' + Math.random().toString(36).slice(2, 12)

        switch (whichKind) {
          case 'js':
            d3.select('head').append('script')
              .attr('id', uid)
              .html(data)
            break
          case 'css':
            d3.select('head').append('style')
              .attr('id', uid)
              .html(data)
            break
          default:
            d3.select('head').append('script')
              .attr('id', uid)
              .html(data)
        }

        resolve(uid)
      }).catch(err => reject(err))
    })
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
