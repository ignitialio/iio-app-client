import _ from 'lodash'
import { EventEmitter } from 'events'

export default class I18n extends EventEmitter {
  constructor() {
    super()

    this._language = 'fr-FR' // navigator.language
    this._languages = []
    this._translations = {}
    this._translationsInit = {}
    this._currentTranslation = null
  }

  initialize(config) {
    if (config) {
      this.addTranslations(config.i18n.data)
      this._translationsInit = _.cloneDeep(this._translations)
      this._languages = config.i18n.languages
      this.setLanguage(this._language)
    } else {
      console.error('error initializing i18n')
    }
  }

  t(what, ...params) {
    if (this._currentTranslation[what]) {
      if (what.match(/`/)) {
        return this.parseTemplate(this._currentTranslation[what].replace(/`/g, ''), params)
      } else {
        return this._currentTranslation[what]
      }
    } else {
      if (what && what.match(/`/)) {
        return this.parseTemplate(what.replace(/`/g, ''), params)
      }
      return what
    }
  }

  addTranslations(data) {
    // console.log('before', this._translations, data)
    _.merge(this._translations, data)
    // console.log('after', this._translations)
    this.setLanguage(this._language)
  }

  resetLanguage() {
    this._translations = this._translationsInit
    this.setLanguage(this._language)
  }

  setLanguage(lang) {
    let index = this._languages.indexOf(lang)
    this._currentTranslation = {}
    for (let t in this._translations) {
      if (index < 0) {
        this._currentTranslation[t] = t
      } else {
        this._currentTranslation[t] = this._translations[t][index]
      }
    }

    this._language = lang

    this.emit('language', this._language)
    // console.log('lang set to ', lang)
  }

  parseTemplate(template, params, fallback) {
    return template.replace(/\$\{[^}]+\}/g, match => {
      let index = match.match(/\[\d\]/)[0].replace('[', '').replace(']', '')
      return params[index]
    })
  }
}
