'use client';
import { DotLottiePlayer } from '@dotlottie/react-player';
import '@dotlottie/react-player/dist/index.css';

const LottieLoader = () => {
  return (
    <DotLottiePlayer
      autoplay
      loop
      speed={1.5}
      src="https://lottie.host/79560fbd-1ae5-4ecf-b66b-1859913b96f1/z79pcYLYZA.lottie"
      //   style={{ height: '300px', width: '300px' }}
    />
  );
};

export default LottieLoader;
