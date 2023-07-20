import fs from 'fs';
import jimp from 'jimp';
import extract from 'png-chunks-extract';
import encode from 'png-chunks-encode';
import PNGtext from 'png-chunk-text';
import ExifReader from 'exifreader';
import webp from 'webp-converter';
import path from 'path';

async function charaRead(img_url, input_format){
    let format;
    if(input_format === undefined){
        if(img_url.indexOf('.webp') !== -1){
            format = 'webp';
        }else{
            format = 'png';
        }
    }else{
        format = input_format;
    }
    
    switch(format){
        case 'webp':
            const exif_data = await ExifReader.load(fs.readFileSync(img_url));
            const char_data = exif_data['UserComment']['description'];
            if (char_data === 'Undefined' && exif_data['UserComment'].value && exif_data['UserComment'].value.length === 1) {
                return exif_data['UserComment'].value[0];
            }
            return char_data;
        case 'png':
            const buffer = fs.readFileSync(img_url);
            const chunks = extract(buffer);
             
            const textChunks = chunks.filter(function (chunk) {
              return chunk.name === 'tEXt';
            }).map(function (chunk) {
                //console.log(text.decode(chunk.data));
              return PNGtext.decode(chunk.data);
            });
            var base64DecodedData = Buffer.from(textChunks[0].text, 'base64').toString('utf8');
            return base64DecodedData;//textChunks[0].text;
            //console.log(textChunks[0].keyword); // 'hello'
            //console.log(textChunks[0].text);    // 'world'
        default:
            break;
    }                   

}

async function charaWrite(img_url, data, target_img, response = undefined, mes = 'ok') {
    try {
        // Read the image, resize, and save it as a PNG into the buffer

        webp

        const rawImg = await jimp.read(img_url);
        const image = await rawImg.cover(400, 600).getBufferAsync(jimp.MIME_PNG);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter(chunk => chunk.create_date === 'tEXt');

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        // Add new chunks before the IEND chunk
        const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
        //chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));

        fs.writeFileSync(target_img, new Buffer.from(encode(chunks)));
        if (response !== undefined) response.send(mes);
        return true;


    } catch (err) {
        console.log(err);
        if (response !== undefined) response.status(500).send(err);
        return false;
    }
}


(async function() {
    const spath = process.argv[2]
    const dpath = process.argv[3] || spath
    const files = fs.readdirSync(spath).filter(e => e.endsWith(".webp"))
    if (!files.length) {
        console.log("Nothing to convert.")
        return
    }

    try { fs.mkdirSync(dpath) } catch {}

    for(const f of files) {
        const source = path.join(spath, f),
            dest = path.join(dpath, path.basename(f, ".webp") + ".png")

        console.log(`Read... ${source}`)
        const data = await charaRead(source)

        console.log(`Convert... ${source} -> ${dest}`)
        await webp.dwebp(source, dest, "-o")

        console.log(`Write... ${dest}`)
        const success = await charaWrite(dest, data, path.parse(dest).name);

        if (!success) {
            console.log(`Failure on ${source} -> ${dest}`);
            continue;
        }

        console.log(`Remove... ${source}`)
        fs.rmSync(source)
    }
})()