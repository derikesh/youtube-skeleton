export function timeoutFunction(ps:Promise<any>,ms:number){

    return Promise.race(
     [   ps,
        new Promise( (_,reject)=>{
            setTimeout( ()=>reject(new Error(`Promise timout on time:${ms} second`)) ,ms);
        } )]
    )

}