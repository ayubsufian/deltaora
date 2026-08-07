// Type declaration shim for @casl/ability v7
// Required because @casl/ability uses ESM-only exports with a `types` field
// that cannot be resolved under moduleResolution: Node.
declare module '@casl/ability' {
  export type Abilities = [string, string | object];
  
  export type MongoQuery<T = object> = Record<string, any>;
  
  export interface MongoAbility<A extends Abilities = Abilities, C = MongoQuery> {
    can(action: string, subject: any, field?: string): boolean;
    cannot(action: string, subject: any, field?: string): boolean;
    relevantRuleFor(action: string, subject: any, field?: string): any;
    on(event: string, handler: Function): () => void;
  }

  export interface AbilityBuilder<T> {
    can(action: string | string[], subject: string | string[], conditions?: any): void;
    cannot(action: string | string[], subject: string | string[], conditions?: any): void;
    build(): T;
  }

  export function createMongoAbility<T = MongoAbility>(rules?: any[], options?: any): T;

  export class AbilityBuilder<T> {
    constructor(factory: typeof createMongoAbility);
    can: (action: string | string[], subject: string | string[], conditions?: any) => void;
    cannot: (action: string | string[], subject: string | string[], conditions?: any) => void;
    build: () => T;
  }

  export class ForbiddenError<T = any> extends Error {
    action: string;
    subject: any;
    subjectType: string;
    field?: string;
    
    static from<U>(ability: U): {
      throwUnlessCan(action: string, subject: any, field?: string): void;
    };
  }

  export type InferSubjects<T> = string;
  
  export function subject(type: string, object: any): any;
  export function detectSubjectType(subject: any): string;
  export function createAliasResolver(aliases: Record<string, string | string[]>): any;
}
