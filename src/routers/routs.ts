import { Router } from "express";  
import { videoProcess } from "./routerFunction/routerFunction";

const router = Router();

router.get('/',(req,res)=>{
    res.status(200).json({message:'the server is working'});
})

router.post('/video-prcoess-test', videoProcess );


export default router;