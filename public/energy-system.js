/**
 * Energy (元气值) System for AI Running Companion
 * 基于Figma设计的元气值机制和哈特心脏形象系统
 */

class EnergySystem {
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

    // 哈特心脏6级状态（基于MovAIQ设计规范）
    this.heartStates = [
      {
        level: 0,
        min: 0, max: 0,
        state: 'dying',
        name: '病变濒危',
        color: '#2C2C2C',      // 深灰黑
        gradient: 'linear-gradient(135deg, #2C2C2C, #3A3A3A)',
        opacity: 0.6,
        scale: 0.6,
        beatSpeed: 10.0,       // 心跳间隔（秒）
        firstBeat: 1.02,
        secondBeat: 1.01,
        glow: false,
        decorations: 'storm',  // 厚重乌云 + 闪电 + 绷带
        face: 'dead',
        cracks: 5,
        message: '危险！需要立即休息！'
      },
      {
        level: 1,
        min: 1, max: 19,
        state: 'depressed',
        name: '垂头丧气',
        color: '#4A2424',      // 灰暗色
        gradient: 'linear-gradient(135deg, #4A2424, #5A3030)',
        opacity: 0.7,
        scale: 0.7,
        beatSpeed: 5.0,
        firstBeat: 1.04,
        secondBeat: 1.02,
        glow: false,
        decorations: 'rain',   // 小乌云下雨
        face: 'spiral',
        cracks: 3,
        message: '快撑不住了...'
      },
      {
        level: 2,
        min: 20, max: 39,
        state: 'low',
        name: '元气不足',
        color: '#8B1A1A',      // 暗紫红色
        gradient: 'linear-gradient(135deg, #8B1A1A, #A02020)',
        opacity: 0.85,
        scale: 0.85,
        beatSpeed: 2.5,
        firstBeat: 1.08,
        secondBeat: 1.05,
        glow: false,
        decorations: 'none',
        face: 'tired',
        cracks: 1,
        message: '有点累了，减速调整一下'
      },
      {
        level: 3,
        min: 40, max: 69,
        state: 'normal',
        name: '基础平稳',
        color: '#C7233A',      // 暗红色
        gradient: 'linear-gradient(135deg, #C7233A, #D42F45)',
        opacity: 1.0,
        scale: 1.0,
        beatSpeed: 1.8,
        firstBeat: 1.12,
        secondBeat: 1.08,
        glow: 'weak',          // 微弱光晕
        glowColor: 'rgba(255, 107, 139, 0.15)',
        decorations: 'none',
        face: 'normal',
        cracks: 0,
        message: '保持节奏，继续前进'
      },
      {
        level: 4,
        min: 70, max: 89,
        state: 'good',
        name: '活力充沛',
        color: '#FF3B30',      // 健康红色
        gradient: 'linear-gradient(135deg, #FF3B30, #FF6B8B)',
        opacity: 1.0,
        scale: 1.15,
        beatSpeed: 1.2,
        firstBeat: 1.15,
        secondBeat: 1.10,
        glow: 'medium',        // 粉色光晕
        glowColor: 'rgba(255, 143, 163, 0.3)',
        decorations: 'sparkles', // 偶尔光点
        face: 'smile',
        cracks: 0,
        message: '状态很棒！保持下去！'
      },
      {
        level: 5,
        min: 90, max: 100,
        state: 'excellent',
        name: '元气爆棚',
        color: '#FF2D55',      // 鲜红色
        gradient: 'linear-gradient(135deg, #FF2D55, #FF6B8B)',
        opacity: 1.0,
        scale: 1.25,
        beatSpeed: 0.8,
        firstBeat: 1.18,
        secondBeat: 1.12,
        glow: 'strong',        // 金色光晕
        glowColor: 'rgba(255, 215, 0, 0.4)',
        decorations: 'notes',  // 音符环绕
        face: 'happy',
        cracks: 0,
        message: '元气爆棚！势不可挡！'
      }
    ];
  }

  /**
   * 更新元气值（基于运动数据）
   */
  updateEnergy(metrics) {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // 转换为秒
    this.lastUpdateTime = now;

    if (!metrics.running) {
      // 未在跑步
      if (metrics.justStopped) {
        this.energy += this.rates.resting * deltaTime;
      } else {
        this.energy += this.rates.idle * deltaTime;
      }
    } else {
      // 正在跑步 - 根据配速质量计算元气变化
      const paceQuality = this.evaluatePace(
        metrics.instantPace,
        metrics.targetPace || 6.0
      );

      let energyChange = 0;

      switch (paceQuality) {
        case 'excellent':
          energyChange = this.rates.excellentPace * deltaTime;
          break;
        case 'good':
          energyChange = this.rates.goodPace * deltaTime;
          break;
        case 'bad':
          energyChange = this.rates.badPace * deltaTime;
          break;
        case 'overExertion':
          energyChange = this.rates.overExertion * deltaTime;
          break;
      }

      // 配速稳定性奖励
      if (metrics.paceConsistency && metrics.paceConsistency > 0.85) {
        energyChange *= 1.3;
      }

      // 长时间运动的疲劳惩罚
      if (metrics.duration > 3600) { // 超过1小时
        const fatigueMultiplier = Math.max(0.5, 1 - (metrics.duration - 3600) / 7200);
        energyChange *= fatigueMultiplier;
      }

      // 心率区间调整
      if (metrics.heartRate) {
        if (metrics.heartRate > 180) {
          energyChange *= 0.6; // 心率过高惩罚
        } else if (metrics.heartRate > 160) {
          energyChange *= 0.8;
        } else if (metrics.heartRate >= 120 && metrics.heartRate <= 150) {
          energyChange *= 1.1; // 理想心率区间奖励
        }
      }

      this.energy += energyChange;
    }

    // 限制在0-100范围内
    this.energy = Math.max(0, Math.min(this.maxEnergy, this.energy));

    return this.energy;
  }

  /**
   * 评估配速质量
   */
  evaluatePace(currentPace, targetPace = 6.0) {
    if (!currentPace || currentPace === Infinity || currentPace <= 0) {
      return 'bad';
    }

    const difference = Math.abs(currentPace - targetPace);

    // 配速过快可能是过度运动
    if (currentPace < targetPace - 1.5) {
      return 'overExertion';
    }

    if (difference < 0.25) return 'excellent'; // 15秒以内
    if (difference < 0.6) return 'good';       // 36秒以内
    if (difference < 1.2) return 'normal';     // 72秒以内

    return 'bad';
  }

  /**
   * 获取当前哈特心脏状态
   */
  getHeartState() {
    for (const state of this.heartStates) {
      if (this.energy >= state.min && this.energy <= state.max) {
        return { ...state, energy: this.getEnergy() };
      }
    }
    return { ...this.heartStates[2], energy: this.getEnergy() };
  }

  /**
   * 获取元气值
   */
  getEnergy() {
    return Math.round(this.energy);
  }

  /**
   * 获取元气百分比
   */
  getEnergyPercent() {
    return `${this.getEnergy()}%`;
  }

  /**
   * 添加元气奖励（如完成里程碑）
   */
  addBoost(amount, reason) {
    this.energy += amount;
    this.energy = Math.min(this.maxEnergy, this.energy);

    console.log(`元气值提升 +${amount} (${reason})`);
    return this.energy;
  }

  /**
   * 重置元气值
   */
  reset() {
    this.energy = this.maxEnergy;
    this.lastUpdateTime = Date.now();
  }

  /**
   * 获取激励语
   */
  getMotivationalMessage() {
    const state = this.getHeartState();
    return state.message;
  }

  /**
   * 获取详细状态
   */
  getDetailedStatus() {
    const state = this.getHeartState();
    return {
      level: state.level,
      energy: this.getEnergy(),
      percent: this.getEnergyPercent(),
      name: state.name,
      state: state.state,
      color: state.color,
      gradient: state.gradient,
      opacity: state.opacity,
      scale: state.scale,
      beatSpeed: state.beatSpeed,
      firstBeat: state.firstBeat,
      secondBeat: state.secondBeat,
      glow: state.glow,
      glowColor: state.glowColor,
      decorations: state.decorations,
      face: state.face,
      cracks: state.cracks,
      message: state.message
    };
  }

  /**
   * 从元气值获取哈特等级 (0-5)
   */
  getHartLevel() {
    const energy = this.getEnergy();
    if (energy >= 90) return 5;
    if (energy >= 70) return 4;
    if (energy >= 40) return 3;
    if (energy >= 20) return 2;
    if (energy >= 1) return 1;
    return 0;
  }
}

// 导出供使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnergySystem;
}
