import type { LevelName, ValidColors, LevelParam, LevelConstructorProps } from './types'

export class Level {
  level: number
  levelName: LevelName
  color: ValidColors

  constructor(level: number, levelName: LevelName, color: ValidColors) {
    this.level = level
    this.levelName = levelName
    this.color = color
  }

  toString() {
    return this.levelName
  }

  isLessThanOrEqualTo(otherLevelParam: LevelParam): boolean {
    const levelRegistry = getLevelRegistry()
    const otherLevel = levelRegistry.getLevel(otherLevelParam)
    if (!otherLevel) throw Error('Other level not found')

    return this.level <= otherLevel.level
  }

  isGreaterThanOrEqualTo(otherLevelParam: LevelParam) {
    const levelRegistry = getLevelRegistry()
    const otherLevel = levelRegistry.getLevel(otherLevelParam)
    if (!otherLevel) throw Error('Other level not found')

    return this.level >= otherLevel.level
  }

  isEqualTo(otherLevelParam: LevelParam) {
    const levelRegistry = getLevelRegistry()
    const otherLevel = levelRegistry.getLevel(otherLevelParam)
    if (!otherLevel) throw Error('Other level not found')

    return this.level === otherLevel.level
  }
}

class LevelRegistry {
  levelsDict: Record<LevelName, Level> = {} as any
  levelsArray: Array<Level> = []

  constructor(
    /** additional levels to add; can also be used to override standard level configurations */
    props?: Partial<LevelConstructorProps>
  ) {
    const standardLevels: LevelConstructorProps = {
      ALL: { value: Number.MIN_VALUE, color: 'gray' },
      TRACE: { value: 5000, color: 'blue' },
      DEBUG: { value: 10000, color: 'cyan' },
      INFO: { value: 20000, color: 'green' },
      WARN: { value: 30000, color: 'yellow' },
      ERROR: { value: 40000, color: 'red' },
      FATAL: { value: 50000, color: 'magenta' },
      MARK: { value: 9007199254740992, color: 'gray' },
      OFF: { value: Number.MAX_VALUE, color: 'gray' },
    }

    this.addLevels(standardLevels as LevelConstructorProps)

    if (props) this.addLevels(props)
  }

  /**
   * converts given String or Level class instance or Level class props to corresponding Level class
   */
  getLevel(level: LevelParam, defaultLevel: Level): Level
  getLevel(level: LevelParam, defaultLevel?: undefined): Level | undefined
  getLevel(level: LevelParam, defaultLevel?: Level): Level | undefined {
    if (!level) {
      return defaultLevel
    }

    if (level instanceof Level) {
      return level as Level
    }

    // a json-serialized level won't be an instance of Level
    if (level instanceof Object) {
      const levelName = level.levelName.toUpperCase() as LevelName

      return this.levelsDict[levelName] ?? defaultLevel
    }

    return this.levelsDict[level] ?? defaultLevel
  }

  private addLevels(levelsParam: Partial<LevelConstructorProps>) {
    if (levelsParam) {
      const levelNames = Object.keys(levelsParam) as LevelName[]

      levelNames.forEach((levelKey) => {
        const levelName = levelKey.toUpperCase() as LevelName
        const levelConfig = levelsParam[levelKey]!

        const level = new Level(levelConfig.value, levelName, levelConfig.color)

        this.levelsDict[levelName] = level
        const existingLevelIndex = this.levelsArray.findIndex((lvl) => lvl.levelName === levelName)

        if (existingLevelIndex > -1) {
          this.levelsArray[existingLevelIndex] = level
        } else {
          this.levelsArray.push(level)
        }
      })
      this.levelsArray.sort((a, b) => a.level - b.level)
    }
  }
}

const levelRegistry = new LevelRegistry()

export function getLevelRegistry(): LevelRegistry {
  return levelRegistry
}
