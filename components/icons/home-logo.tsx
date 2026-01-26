import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

export function HomeLogo({ size = 68 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <G transform="translate(10, 10) scale(0.83)">
        {/* Circular blue background - keep at current size */}
        <Circle cx="60" cy="60" r="60" fill="url(#paint0_linear_home_logo)" />
        
        {/* Logo elements - scaled down further and centered */}
        <G transform="translate(60, 60) scale(0.75) translate(-60, -60)">
          {/* Outer ring - white/light blue gradient */}
          <Path d="M90 15.192C85.5727 11.1575 80.3846 8.04754 74.7397 6.04433C69.0948 4.04111 63.1068 3.185 57.1267 3.52619C51.1467 3.86738 45.2949 5.39899 39.9145 8.03124C34.534 10.6635 29.7333 14.3434 25.7936 18.8552C21.8539 23.367 18.8546 28.62 16.9716 34.3061C15.0885 39.9922 14.3596 45.997 14.8275 51.9685C15.2954 57.94 16.9508 63.7579 19.6965 69.0813C22.4423 74.4047 26.2231 79.1264 30.8175 82.9695C41.3211 91.7021 50.0973 102.324 56.6925 114.286C57.0149 114.881 57.4927 115.379 58.0751 115.725C58.6574 116.071 59.3226 116.252 60 116.251C60.6769 116.25 61.341 116.067 61.922 115.72C62.503 115.372 62.9792 114.874 63.3 114.278L63.6075 113.701C70.2501 101.884 79.0081 91.388 89.445 82.737C94.2816 78.5572 98.1713 73.394 100.854 67.592C103.538 61.7899 104.953 55.4823 105.005 49.0901C105.058 42.6978 103.747 36.3679 101.159 30.5225C98.5716 24.6771 94.7673 19.4507 90 15.192ZM60 67.5007C56.2916 67.5007 52.6665 66.4011 49.5831 64.3408C46.4996 62.2805 44.0964 59.3522 42.6773 55.9261C41.2581 52.5 40.8868 48.7299 41.6103 45.0928C42.3337 41.4557 44.1195 38.1147 46.7417 35.4925C49.364 32.8703 52.7049 31.0845 56.3421 30.361C59.9792 29.6376 63.7492 30.0089 67.1753 31.428C70.6014 32.8472 73.5298 35.2504 75.5901 38.3338C77.6503 41.4172 78.75 45.0424 78.75 48.7508C78.744 53.7217 76.7667 58.4874 73.2517 62.0024C69.7367 65.5174 64.971 67.4948 60 67.5007Z" fill="url(#paint1_linear_home_logo)" />
          
          {/* Inner circle - white/light blue gradient */}
          <Circle cx="60" cy="48" r="30" fill="url(#paint2_linear_home_logo)" />
          
          {/* Wrench/pin icon - blue gradient (switched from white) */}
          <Path d="M52.0381 16.9834C57.4005 15.6352 63.018 15.6743 68.3614 17.0957C68.9752 17.2602 69.5351 17.5829 69.9844 18.0322C70.4338 18.4816 70.7574 19.0414 70.9219 19.6553C71.0871 20.2716 71.0863 20.9212 70.92 21.5371C70.7536 22.1529 70.4274 22.7138 69.9747 23.1631L56.0977 37.04L58.0176 50.4814L71.459 52.4014L85.336 38.5244C85.7853 38.0717 86.3462 37.7454 86.962 37.5791C87.5779 37.4128 88.2275 37.412 88.8438 37.5771C89.4577 37.7417 90.0175 38.0653 90.4669 38.5146C90.9162 38.964 91.2389 39.5239 91.4034 40.1377C92.683 44.9133 92.8553 49.9072 91.9229 54.7422C88.854 69.5523 75.7355 80.6836 60.0157 80.6836C42.0185 80.6835 27.429 66.0939 27.4288 48.0967C27.4288 47.4476 27.4499 46.8028 27.4874 46.1631C27.6786 43.5991 28.1727 41.0565 28.9678 38.5898C30.6642 33.3272 33.6724 28.5824 37.7081 24.8027C41.7439 21.023 46.6756 18.3317 52.0381 16.9834Z" fill="url(#paint3_linear_home_logo)" />
        </G>
      </G>
      
      <Defs>
        {/* Blue circular background gradient */}
        <LinearGradient id="paint0_linear_home_logo" x1="60" y1="0" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4eb1ff" />
          <Stop offset="1" stopColor="#4eb1ff" />
        </LinearGradient>
        
        {/* Outer ring - white/light blue (switched from blue) */}
        <LinearGradient id="paint1_linear_home_logo" x1="59.8484" y1="3.45312" x2="59.8484" y2="116.251" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#EBF4FF" />
          <Stop offset="1" stopColor="white" />
        </LinearGradient>
        
        {/* Inner circle - white/light blue (switched from blue) */}
        <LinearGradient id="paint2_linear_home_logo" x1="60" y1="18" x2="60" y2="78" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#EBF4FF" />
          <Stop offset="1" stopColor="white" />
        </LinearGradient>
        
        {/* Wrench/pin icon - white/light blue (stays white as shown in image) */}
        <LinearGradient id="paint3_linear_home_logo" x1="59.971" y1="16" x2="59.971" y2="80.6839" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#5299FE" />
          <Stop offset="1" stopColor="#70B7FF" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

