export type BlockType = 'routine' | 'task' | 'prep' | 'recovery' | 'sleep';

export interface TimeBlock {
  id:    string;
  title: string;
  start: Date;
  end:   Date;
  type:  BlockType;
  isEvent?:       boolean;
  protocolColor?: string; // reused as event color when isEvent=true
}

export interface HorizonSpan {
  id:    string;
  title: string;
  start: Date;
  end:   Date;
  color: string;
}
