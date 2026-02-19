import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useScrollTest(scrollFn: (offset: number) => void) {
    useEffect(() => {
        let interval: any;
        const timeout = setTimeout(() => {
            let start = 0;
            let inc = 1000;
            interval = setInterval(() => {
                scrollFn((start += inc));
            }, 500);
        }, 1000);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    });
}
