import cloneDeep from 'lodash.clonedeep';

import userAgents from './user-agents.json';


// Normalizes the total weight to 1 and constructs a cumulative distribution.
const makeCumulativeWeightIndexPairs = (weightIndexPairs) => {
  const totalWeight = weightIndexPairs.reduce((sum, [weight]) => sum + weight, 0);
  let sum = 0;
  return weightIndexPairs.map(([weight, index]) => {
    sum += weight / totalWeight;
    return [sum, index];
  });
};

// Precompute these so that we can quickly generate unfiltered user agents.
const defaultWeightIndexPairs = userAgents.map(({ weight }, index) => [weight, index]);
const defaultCumulativeWeightIndexPairs = makeCumulativeWeightIndexPairs(defaultWeightIndexPairs);


// Turn the various filter formats into a single filter function that acts on raw user agents.
const constructFilter = (filters, accessor = parentObject => parentObject) => {
  let childFilters;
  if (typeof filters === 'function') {
    childFilters = [filters];
  } else if (filters instanceof RegExp) {
    childFilters = [
      value => (
        typeof value === 'object' && value && value.userAgent
          ? filters.test(value.userAgent)
          : filters.test(value)
      ),
    ];
  } else if (filters instanceof Array) {
    childFilters = filters.map(childFilter => constructFilter(childFilter));
  } else if (typeof filters === 'object') {
    childFilters = Object.entries(filters).map(([key, valueFilter]) => (
      constructFilter(valueFilter, parentObject => parentObject[key])
    ));
  } else {
    childFilters = [
      value => (
        typeof value === 'object' && value && value.userAgent
          ? filters === value.userAgent
          : filters === value
      ),
    ];
  }

  return (parentObject) => {
    try {
      const value = accessor(parentObject);
      return childFilters.every(childFilter => childFilter(value));
    } catch (error) {
      // This happens when a user-agent lacks a nested property.
      return false;
    }
  };
};


// Construct normalized cumulative weight index pairs given the filters.
const constructCumulativeWeightIndexPairsFromFilters = (filters) => {
  if (!filters) {
    return defaultCumulativeWeightIndexPairs;
  }

  const filter = constructFilter(filters);

  const weightIndexPairs = [];
  userAgents.forEach((rawUserAgent, index) => {
    if (filter(rawUserAgent)) {
      weightIndexPairs.push([rawUserAgent.weight, index]);
    }
  });
  return makeCumulativeWeightIndexPairs(weightIndexPairs);
};


const setCumulativeWeightIndexPairs = (userAgent, cumulativeWeightIndexPairs) => {
  Object.defineProperty(userAgent, 'cumulativeWeightIndexPairs', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: cumulativeWeightIndexPairs,
  });
};


export default class UserAgent extends Function {
  constructor(filters) {
    super();
    setCumulativeWeightIndexPairs(this, constructCumulativeWeightIndexPairsFromFilters(filters));
    if (this.cumulativeWeightIndexPairs.length === 0) {
      throw new Error('No user agents matched your filters.');
    }

    this.randomize();

    return new Proxy(this, {
      apply: () => this.random(),
      get: (target, property, receiver) => {
        const dataCandidate = target.data && typeof property === 'string'
          && Object.prototype.hasOwnProperty.call(target.data, property)
          && Object.prototype.propertyIsEnumerable.call(target.data, property);
        if (dataCandidate) {
          const value = target.data[property];
          if (value !== undefined) {
            return value;
          }
        }

        return Reflect.get(target, property, receiver);
      },
    });
  }

  static random = (filters) => {
    try {
      return new UserAgent(filters);
    } catch (error) {
      return null;
    }
  };

  //
  // Standard Object Methods
  //

  [Symbol.toPrimitive] = () => (
    this.data.userAgent
  );

  toString = () => (
    this.data.userAgent
  );

  random = () => {
    const userAgent = new UserAgent();
    setCumulativeWeightIndexPairs(userAgent, this.cumulativeWeightIndexPairs);
    userAgent.randomize();
    return userAgent;
  };

  randomize = () => {
    // Find a random raw random user agent.
    const randomNumber = Math.random();
    const [, index] = this.cumulativeWeightIndexPairs
      .find(([cumulativeWeight]) => cumulativeWeight > randomNumber);
    const rawUserAgent = userAgents[index];

    this.data = cloneDeep(rawUserAgent);
  }
}
