class ShareManager {
  constructor() {
    this.defaultTitle = '弹弹消消乐 - 超好玩的休闲游戏！'
    this.defaultImageUrl = ''
    
    this.initShareMenu()
  }
  
  initShareMenu() {
    try {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
      
      wx.onShareAppMessage(() => this.getShareInfo())
    } catch (e) {
    }
  }
  
  getShareInfo(score = null) {
    const title = score 
      ? `我在弹弹消消乐获得了${score}分，你能超越吗？`
      : this.defaultTitle
    
    return {
      title: title,
      imageUrl: this.defaultImageUrl,
      query: ''
    }
  }
  
  share(score = null) {
    try {
      wx.shareAppMessage(this.getShareInfo(score))
    } catch (e) {
    }
  }
  
  reportScore(score) {
    try {
      wx.setUserCloudStorage({
        KVDataList: [{
          key: 'score',
          value: JSON.stringify({
            wxgame: {
              score: score,
              update_time: Date.now()
            }
          })
        }]
      })
    } catch (e) {
    }
  }
}

export default ShareManager
