const sharedCanvas = wx.getSharedCanvas()
const ctx = sharedCanvas.getContext('2d')

let rankData = []

function drawRankList() {
  const width = sharedCanvas.width
  const height = sharedCanvas.height
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, width, height)
  
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 24px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('好友排行榜', width / 2, 40)
  
  if (rankData.length === 0) {
    ctx.font = '18px Arial'
    ctx.fillStyle = '#AAAAAA'
    ctx.fillText('暂无排行数据', width / 2, height / 2)
    return
  }
  
  const startY = 80
  const itemHeight = 50
  
  rankData.forEach((item, index) => {
    const y = startY + index * itemHeight
    
    ctx.fillStyle = index < 3 ? '#FFD700' : '#FFFFFF'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`${index + 1}`, 20, y)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '16px Arial'
    ctx.fillText(item.nickname || '玩家', 60, y)
    
    ctx.textAlign = 'right'
    ctx.fillText(`${item.score}分`, width - 20, y)
  })
}

function fetchFriendData() {
  wx.getFriendCloudStorage({
    keyList: ['score'],
    success: (res) => {
      rankData = res.data
        .filter(item => item.KVDataList && item.KVDataList.length > 0)
        .map(item => {
          let score = 0
          try {
            const data = JSON.parse(item.KVDataList[0].value)
            score = data.wxgame ? data.wxgame.score : 0
          } catch (e) {
            score = 0
          }
          return {
            nickname: item.nickname,
            avatarUrl: item.avatarUrl,
            score: score
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
      
      drawRankList()
    },
    fail: () => {
      rankData = []
      drawRankList()
    }
  })
}

wx.onMessage((data) => {
  if (data.type === 'showRank') {
    fetchFriendData()
  } else if (data.type === 'hideRank') {
    ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height)
  }
})
