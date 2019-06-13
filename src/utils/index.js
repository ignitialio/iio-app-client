import moment from 'moment'
import 'moment/locale/fr'
import 'moment/locale/es'
import * as d3 from 'd3'
import _ from 'lodash'
import loadjs from 'loadjs'
import * as axios from 'axios'
import empty from 'json-schema-empty'

export default {
  /* used for deep update in JS object given a path description */
  updatePropertyByPath(obj, path, val, removal) {
    // console.log(JSON.stringify(obj, null, 2), path, val)
    if (path.match(/\./)) {
      // console.log('path=', path, ', val=', JSON.stringify(val))
      let pathArray = path.split('.')
      let propPath = pathArray.slice(1).join('.')
      let prop = pathArray[0]
      if (prop.match(/\[.*\]/)) {
        let arrName = prop.slice(0, prop.indexOf('['))
        let idx = parseInt(path.match(/\[.*\]/)[0].replace('[', '').replace(']', ''))

        obj[arrName] = obj[arrName] || []
        obj[arrName][idx] = obj[arrName][idx] || {}
        this.updatePropertyByPath(obj[arrName][idx], propPath, val, removal)
      } else {
        this.updatePropertyByPath(obj[prop], propPath, val, removal)
      }
    } else if (path.match(/\[/)) {
      let count = path.match(/\[/g).length
      if (count === 1) {
        let idx = parseInt(path.match(/\[.*\]/)[0].replace('[', '').replace(']', ''))
        let prop = path.match(/.*\[/)[0].replace('[', '')

        if (!removal) {
          obj[prop][idx] = val
          // console.log('idx', idx, 'prop', prop, obj[prop][idx])
        } else {
          obj[prop].splice(idx, 1)
          // console.log('idx removal ', idx, 'prop', prop)
        }
      } else {
        let matches = path.match(/\[\d\]/g)
        let idxs = _.map(matches, function(e) {
          return parseInt(e.replace('[', '').replace(']', ''))
        })

        let prop = path.match(/\w+\[/)[0].replace('[', '')

        if (!removal) {
          // manage array of arrays: to be improved
          // console.log('prop = ', obj[prop], 'val = ', val, JSON.stringify(obj[prop]))

          obj[prop] = obj[prop] || []
          // console.log(JSON.stringify(obj[prop]))
          let fullObj = obj[prop]
          for (let i = 0; i < idxs.length; i++) {
            if (i < idxs.length - 1) {
              fullObj[idxs[i]] = fullObj[idxs[i]] || []
              fullObj = fullObj[idxs[i]]
            } else {
              fullObj[idxs[i]] = parseFloat(val)
            }
          }

          // console.log('idxs', idxs, 'prop', prop, fullObj, JSON.stringify(obj[prop]))
        } else {
          obj[prop].splice(idxs[0], 1)
          // console.log('idx removal ', idx, 'prop', prop)
        }
      }
    } else {
      obj[path] = val
    }
  },

  fromNow(date) {
    let lang = this.$i18n._language.split('-')[0]
    return date ? moment(date).locale(lang).fromNow() : ''
  },

  prettyDate(date) {
    let lang = this.$i18n._language.split('-')[0]
    return date ? moment(date).locale(lang).format('DD MMMM YYYY') : ''
  },

  prettyDateAndTime(date) {
    let lang = this.$i18n._language.split('-')[0]
    return date ? moment(date).locale(lang).format('DD MMMM YYYY  hh:mm') : ''
  },

  loadOpenLayers(version = '4.6.5') {
    return new Promise((resolve, reject) => {
      if (!loadjs.isDefined('openlayers')) {
        loadjs(
          [
            'https://cdnjs.cloudflare.com/ajax/libs/openlayers/' + version + '/ol.css',
            'https://cdnjs.cloudflare.com/ajax/libs/openlayers/' + version + '/ol.js'
          ], 'openlayers', {
            success: () => {
              // console.log('openlayers', global.ol)
              resolve(global.ol)
            },
            error: err => reject(err)
          })
      } else {
        resolve(global.ol)
      }
    })
  },

  loadAsync(what, whichKind) {
    return new Promise((resolve, reject) => {
      axios({
        url: what,
        method: 'get',
        responseType: 'text'
      }).then(response => {
        let uid = 'la_' + Math.random().toString(36).slice(2, 12)

        if (response.data) {
          switch (whichKind) {
            case 'js':
              d3.select('head').append('script')
                .attr('id', uid)
                .html(response.data)
              break
            case 'css':
              d3.select('head').append('style')
                .attr('id', uid)
                .html(response.data)
              break
            default:
              d3.select('head').append('script')
                .attr('id', uid)
                .html(response.data)
          }
        }

        resolve(uid)
      }).catch(err => reject(err))
    })
  },

  token() {
    return localStorage.token
  },

  waitForDOMReady(selector, delay = 5000) {
    return new Promise((resolve, reject) => {
      let checkInterval = setInterval(() => {
        let el = d3.select(selector)
        if (!el.empty()) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(el)
        }
      }, 50)

      let timeout = setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('timeout for DOM element ' + selector))
      }, delay)
    })
  },

  /* get file url selecting between S3 and other endpoints */
  fileUrl(path, defaultPath) {
    if (!path) {
      return defaultPath
    } else if (!path.match(/api\/uploads\//)) {
      return path
    } else {
      return path + '&token=' + this.$utils.token()
    }
  },

  waitForProperty(obj, prop, delay = 5000) {
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
          reject(new Error('timeout: property [ ' + prop + ' ] is not available'))
        }
      }, delay)
    })
  },

  waitForProperties(obj, props, delay = 5000) {
    return new Promise((resolve, reject) => {
      var checkTimeout
      let notReady

      var checkInterval = setInterval(() => {
        let ready = true
        notReady = []

        for (let prop of props) {
          ready = ready && obj[prop]
          if (!obj[prop]) {
            if (notReady.indexOf(prop) === -1) notReady.push(prop)
          }
        }

        if (ready) {
          clearInterval(checkInterval)
          clearTimeout(checkTimeout) // nothing if undefined

          resolve(obj)
        }
      }, 100)

      checkTimeout = setTimeout(() => {
        if (checkInterval) {
          clearInterval(checkInterval)
          reject(new Error('timeout: properties [ ' + notReady + ' ] are not available'))
        }
      }, delay )
    })
  },

  generateDataFormJSONSchema(args) {
    return empty(args.schema)
  },

  getByPath(obj, path) {
    path = path.split('.')

    for (let p of path) {
      let arrIndex = p.match(/(.*?)\[(.*?)\]/)

      if (arrIndex) {
        obj = obj[arrIndex[1]][arrIndex[2]]
      } else if (obj[p] !== undefined) {
        obj = obj[p]
      }
      else return null
    }

    return obj
  },

  setByPath(obj, path, value) {
    path = path.split('.')
    let level = path[0]
    let next = path.slice(1).join('.')
    if (next === '') {
      obj[level] = value
    } else {
      obj[level] = obj[level] || {}
      this.setByPath(obj[level], next, value)
    }
  }
}
