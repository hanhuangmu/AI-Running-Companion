/**
 * Energy (元气值) System for AI Running Companion
 * 基于Figma设计的元气值机制和哈特心脏形象系统
 * 6个等级 (Lv.0-5) + 双节拍心跳 + 装饰元素
 */

// 全局定义EnergySystem类
window.EnergySystem = class {
  constructor() {
    this.energy = 100; // 当前元气值 (0-100)
    this.maxEnergy = 100;
    this.lastUpdateTime = Date.now();

    // 元气值变化速率
    this.rates = {
      goodPace: 0.5,        // 配速良好时每秒获得的元气
      excellentPace: 1.0,   // 配速优秀时的奖励
      badPace: -0.8,        // 配速不佳时的元气消耗
      idle: -0.05,          // 未运动时的缓慢流失
      resting: 0.3,         // 休息时的恢复速率
      overExertion: -1.5    // 过度运动时的惩罚
    };

    // 哈特心脏状态（6个等级 Lv.0-5）
    this.heartStates = [
      {
        level: 0,
        min: 0, max: 20,
        state: 'dead',
        name: '病变濒危',
        color: '#2C2C2C',
        scale: 0.6,
        beatSpeed: 10.0,
        opacity: 0.6,
        message: '病变濒危！马上运动！'
      },
      {
        level: 1,
        min: 21, max: 40,
        state: 'critical',
        name: '严重不足',
        color: '#4A4A4A',
        scale: 0.7,
        beatSpeed: 8.0,
        opacity: 0.7,
        message: '元气严重不足，需要运动！'
      },
      {
        level: 2,
        min: 41, max: 60,
        state: 'weak',
        name: '元气不足',
        color: '#6E6E6E',
        scale: 0.8,
        beatSpeed: 6.0,
        opacity: 0.8,
        message: '元气不足，建议运动补充'
      },
      {
        level: 3,
        min: 61, max: 80,
        state: 'normal',
        name: '状态正常',
        color: '#FF5C8D',
        scale: 0.9,
        beatSpeed: 4.0,
        opacity: 0.9,
        message: '元气状态正常'
      },
      {
        level: 4,
        min: 81, max: 95,
        state: 'good',
        name: '元气充沛',
        color: '#FF3377',
        scale: 1.0,
        beatSpeed: 2.0,
        opacity: 1.0,
        message: '元气充沛，状态良好！'
      },
      {
        level: 5,
        min: 96, max: 100,
        state: 'excellent',
        name: '元气满溢',
        color: '#FF0055',
        scale: 1.1,
        beatSpeed: 1.0,
        opacity: 1.0,
        message: '元气满溢，状态极佳！'
      }
    ];
  }

  // 初始化元气值系统
  init() {
    // 查找所有心形图标
    this.heartIcons = document.querySelectorAll('.heart-icon');
    
    // 设置定时器，定期更新元气值
    setInterval(() => {
      // 在实际应用中，这里会根据用户活动自动调整元气值
      this.updateHeartState();
    }, 1000);
    
    return this;
  }

  // 更新元气值
  updateEnergy(params = {}) {
    const { activity = 'idle', paceQuality = 'normal' } = params;
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // 转换为秒
    this.lastUpdateTime = now;
    
    let rate = 0;
    
    // 根据活动类型和质量确定变化率
    if (activity === 'running') {
      switch(paceQuality) {
        case 'excellent': rate = this.rates.excellentPace; break;
        case 'good': rate = this.rates.goodPace; break;
        case 'bad': rate = this.rates.badPace; break;
        default: rate = 0;
      }
    } else if (activity === 'resting') {
      rate = this.rates.resting;
    } else {
      rate = this.rates.idle;
    }
    
    // 应用变化率
    this.energy += rate * deltaTime;
    
    // 确保元气值在有效范围内
    this.energy = Math.max(0, Math.min(this.energy, this.maxEnergy));
    
    // 更新心脏状态
    this.updateHeartState();
    
    return this.energy;
  }

  // 获取当前心脏状态
  getCurrentHeartState() {
    for (const state of this.heartStates) {
      if (this.energy >= state.min && this.energy <= state.max) {
        return state;
      }
    }
    return this.heartStates[0]; // 默认返回最低状态
  }

  // 更新心脏状态
  updateHeartState() {
    if (!this.heartIcons || this.heartIcons.length === 0) return;
    
    const state = this.getCurrentHeartState();
    
    // 更新所有心形图标
    this.heartIcons.forEach(icon => {
      // 设置数据属性
      icon.dataset.state = state.state;
      icon.dataset.level = state.level;
      
      // 应用视觉效果
      icon.style.transform = `scale(${state.scale})`;
      icon.style.opacity = state.opacity;
      icon.style.color = state.color;
      
      // 设置心跳动画
      icon.style.animation = `heartbeat-lv${state.level} ${state.beatSpeed}s infinite`;
    });
    
    // 更新元气消息
    const energyMsg = document.querySelector('.energy-message');
    if (energyMsg) {
      energyMsg.textContent = state.message;
    }
  }
};
