declare module "kiss-ffmpeg" {
    import {EventEmitter} from 'events';

    export interface OptionsInterface {
        [key:string] : string | number | boolean | null;
    }

    export interface InputerInterface {
        url:string,
        options?:OptionsInterface
    }
    
    export interface OutputInterface {
        url:string,
        options?:OptionsInterface
    }

    export class FFmpeg extends EventEmitter {
        inputs:InputerInterface | InputerInterface[];
        outputs:OutputInterface | OutputInterface[];
        global:any;
        spawnOPtions?:object;
        run():Promise<void>;
        runSync():void
    }

}