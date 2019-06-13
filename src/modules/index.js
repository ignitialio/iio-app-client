import utils from '../utils'

export default class Modules {
  constructor(socket) {
    this.socket = socket
    this.uuid = Math.random().toString(36).slice(2)

    // event module:up means a new module service available
    this.socket.on('module:up', module => {
      if (module) {
        console.log('module:up', module)
        // root level methods
        if (module.methods) {
          for (let method in module.methods) {
            this.register(module.name, method)
          }
        }

        // sub services and their methods
        if (module.subs) {
          for (let subservice in module.subs) {
            for (let method of module.subs[subservice]) {
              this.register(module.name + ':' + subservice, method)
            }
          }
        }
      }
    })
  }

  initialize(services) {
    services.waitForService('config').then(config => {
      config.modules().then(result => {
        console.log('modules', result)
        for (let s in result.list) {
          let module = result.list[s]

          // root level methods
          if (module.methods) {
            for (let method of module.methods) {
              this.register(module.name, method)
            }
          }

          // sub services and their methods
          if (module.subs) {
            for (let subservice in module.subs) {
              for (let method of module.subs[subservice]) {
                this.register(module.name + ':' + subservice, method)
              }
            }
          }
        }
      }).catch(err => {
        console.log(err)
      })
    }).catch(err => {
      console.log(err)
    })
  }

  register(service, method) {
    // console.log('register module', service, method)
    let setMethod = serviceName => {
      return args => {
        return new Promise((resolve, reject) => {
          let token = Math.random().toString(36).slice(2)
          let topic = 'module:' + serviceName + ':' + method + ':' + token

          let timeout = setTimeout(() => {
            this.socket.off(topic)
            reject(new Error('timeout for ' + topic))
          }, 30000)

          this.socket.once(topic, data => {
            clearTimeout(timeout)
            if (data.err) {
              reject(data.err)
            } else {
              resolve(data.result)
            }

            // heartbeat
            this.$ws.heartbeat = true
          })

          // 2018/08/15: tokenized userID
          let fullArgs = {
            topic: 'module:' + serviceName + ':request',
            args: args,
            token: token,
            method: method,
            userId: localStorage.token
          }

          this.socket.emit('module:event', fullArgs)
        })
      }
    }

    // if subservices concerned
    if (service.match(':')) {
      let subservice = service.split(':')[1]
      service = service.split(':')[0]

      this[service] = this[service] || {}
      this[service][subservice] = this[service][subservice] || {}

      this[service][subservice][method] = setMethod(service + ':' + subservice)
    // ... else only root level methods
    } else {
      this[service] = this[service] || {}

      this[service][method] = setMethod(service)
    }
  }

  waitForService(name, sub) {
    return new Promise((resolve, reject) => {
      var checkTimeout

      var checkInterval = setInterval(() => {
        if (sub) {
          if (this[name] && this[name][sub]) {
            clearInterval(checkInterval)
            clearTimeout(checkTimeout) // nothing if undefined

            resolve(this[name][sub])
          }
        } else {
          if (this[name]) {
            clearInterval(checkInterval)
            clearTimeout(checkTimeout) // nothing if undefined

            resolve(this[name])
          }
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          if (sub) {
            reject(new Error('Timeout: subservice ' + sub + ' of service ' + name + ' is not available'))
          } else {
            reject(new Error('Timeout: service ' + name + ' is not available'))
          }
        }
      }, 5000)
    })
  }
}
