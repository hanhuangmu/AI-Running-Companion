/**
 * Energy (元气值) System for AI Running Companion
 * 基于Figma设计的元气值机制和哈特心脏形象系统
 * 增强版 - 6个等级 (Lv.0-5) + 双节拍心跳 + 装饰元素
 */

class EnergySystemFigma {
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

    // 哈特心脏状态（基于Figma设计 - 6个等级 Lv.0-5）
    this.heartStates = [
      {
        min: 0, max: 0,
        level: 0,
        state: 'dead',
        name: '病变濒危',
        color: '#2C2C2C',      // 深灰黑
        gradient: 'linear-gradient(135deg, #2C2C2C, #1A1A1A)',
        scale: 0.6,
        beatSpeed: 10.0,       // 心跳间隔（秒）
        firstBeat: 1.02,       // 第一跳幅度
        secondBeat: 1.01,      // 第二跳幅度
        opacity: 0.6,
        glow: {
          visible: false,
          layers: []
        },
        cracks: [              // 裂纹路径
          'M 50,25 Q 55,40 60,55',
          'M 60,30 Q 65,45 70,60',
          'M 45,45 Q 50,55 55,65',
          'M 65,50 Q 70,60 75,70',
          'M 55,35 L 58,50',
        ],
        message: '病变濒危！马上运动！',
        decorations: {
          type: 'storm',       // 厚重乌云 + 闪电 + 绷带
          elements: ['heavyCloud', 'lightning', 'bandage']
        }
      },
      {
        min: 1, max: 19,
        level: 1,
        state: 'depressed',
        name: '垂头丧气',
        color: '#4A2424',      // 灰暗色
        gradient: 'linear-gradient(135deg, #4A2424, #3A1A1A)',
        scale: 0.7,
        beatSpeed: 5.0,
        firstBeat: 1.04,
        secondBeat: 1.02,
        opacity: 0.7,
        glow: {
          visible: false,
          layers: []
        },
        cracks: [
          'M 55,30 Q 58,45 60,60',
          'M 65,35 Q 68,50 70,65',
          'M 50,50 Q 55,60 60,70',
        ],
        message: '垂头丧气...需要活力',
        decorations: {
          type: 'rain',        // 小乌云 + 雨滴
          elements: ['smallCloud', 'raindrops']
        }
      },
      {
        min: 20, max: 39,
        level: 2,
        state: 'tired',
        name: '元气不足',
        color: '#8B1A1A',      // 暗紫红
        gradient: 'linear-gradient(135deg, #8B1A1A, #6A1515)',
        scale: 0.85,
        beatSpeed: 2.5,
        firstBeat: 1.08,
        secondBeat: 1.05,
        opacity: 0.85,
        glow: {
          visible: false,
          layers: []
        },
        cracks: [
          'M 55,30 Q 58,45 60,60',
        ],
        message: '元气不足，有点累',
        decorations: {
          type: 'cracks',      // 表面裂纹
          elements: ['cracks']
        }
      },
      {
        min: 40, max: 69,
        level: 3,
        state: 'normal',
        name: '基础平稳',
        color: '#C7233A',      // 暗红色
        gradient: 'linear-gradient(135deg, #C7233A, #A51D2D)',
        scale: 1.0,
        beatSpeed: 1.8,
        firstBeat: 1.12,
        secondBeat: 1.08,
        opacity: 1.0,
        glow: {
          visible: true,
          layers: [
            { color: 'rgba(255, 107, 139, 0.15)', opacity: 0.15, maxScale: 1.3 }
          ]
        },
        cracks: [],
        message: '基础平稳，继续加油',
        decorations: {
          type: 'none',
          elements: []
        }
      },
      {
        min: 70, max: 89,
        level: 4,
        state: 'energetic',
        name: '活力充沛',
        color: '#FF3B30',      // 健康红
        gradient: 'linear-gradient(135deg, #FF3B30, #FF6B8B)',
        scale: 1.15,
        beatSpeed: 1.2,
        firstBeat: 1.15,
        secondBeat: 1.10,
        opacity: 1.0,
        glow: {
          visible: true,
          layers: [
            { color: 'rgba(255, 143, 163, 0.3)', opacity: 0.3, maxScale: 1.6 }
          ]
        },
        cracks: [],
        message: '活力充沛，状态很好！',
        decorations: {
          type: 'sparkles',    // 粉色光晕 + 偶尔光点
          elements: ['sparkles', 'particles']
        }
      },
      {
        min: 90, max: 100,
        level: 5,
        state: 'excellent',
        name: '元气爆棚',
        color: '#FF2D55',      // 鲜红色
        gradient: 'linear-gradient(135deg, #FF2D55, #FF6B8B)',
        scale: 1.25,
        beatSpeed: 0.8,
        firstBeat: 1.18,
        secondBeat: 1.12,
        opacity: 1.0,
        glow: {
          visible: true,
          layers: [
            { color: 'rgba(255, 215, 0, 0.4)', opacity: 0.4, maxScale: 1.8 },  // 金色
            { color: 'rgba(255, 143, 163, 0.25)', opacity: 0.25, maxScale: 2.0 } // 粉色
          ]
        },
        cracks: [],
        message: '元气爆棚！完美状态！',
        decorations: {
          type: 'notes',       // 金色光晕 + 音符环绕
          elements: ['musicNotes', 'goldenGlow', 'particles']
        }
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
    return { ...this.heartStates[3], energy: this.getEnergy() }; // 默认返回Lv.3
  }

  /**
   * 根据元气值获取等级 (0-5)
   */
  getLevel() {
    if (this.energy === 0) return 0;
    if (this.energy >= 1 && this.energy <= 19) return 1;
    if (this.energy >= 20 && this.energy <= 39) return 2;
    if (this.energy >= 40 && this.energy <= 69) return 3;
    if (this.energy >= 70 && this.energy <= 89) return 4;
    if (this.energy >= 90) return 5;
    return 3; // 默认
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

    console.log(`✨ 元气值提升 +${amount} (${reason})`);
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
   * 获取详细状态（用于UI更新）
   */
  getDetailedStatus() {
    const state = this.getHeartState();
    return {
      energy: this.getEnergy(),
      percent: this.getEnergyPercent(),
      level: state.level,
      state: state.state,
      name: state.name,
      color: state.color,
      gradient: state.gradient,
      scale: state.scale,
      beatSpeed: state.beatSpeed,
      firstBeat: state.firstBeat,
      secondBeat: state.secondBeat,
      opacity: state.opacity,
      glow: state.glow,
      cracks: state.cracks,
      message: state.message,
      decorations: state.decorations
    };
  }
}

// 导出供使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnergySystemFigma;
}
