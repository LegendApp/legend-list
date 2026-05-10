const MIN_INITIAL_CONTAINER_POOL_SIZE = 32;
const MAX_INITIAL_SPARE_CONTAINERS = 64;

export function getInitialContainerPoolSize(
    dataLength: number,
    numContainers: number,
    initialContainerPoolRatio: number,
) {
    if (dataLength <= 0 || numContainers <= 0) {
        return 0;
    }

    const ratioPoolSize = Math.ceil(numContainers * initialContainerPoolRatio);
    const cappedSparePoolSize = numContainers + MAX_INITIAL_SPARE_CONTAINERS;
    const targetPoolSize = Math.max(
        numContainers,
        Math.min(ratioPoolSize, cappedSparePoolSize),
        Math.min(dataLength, MIN_INITIAL_CONTAINER_POOL_SIZE),
    );
    const maxUsefulPoolSize = Math.max(dataLength, numContainers);

    return Math.min(maxUsefulPoolSize, targetPoolSize);
}

export function getExpandedContainerPoolSize(dataLength: number, numContainers: number) {
    if (dataLength <= 0 || numContainers <= 0) {
        return 0;
    }

    return Math.min(Math.max(dataLength, numContainers), Math.max(numContainers, Math.ceil(numContainers * 1.5)));
}
