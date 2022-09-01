
//generate-keys.js
const openpgp = require('openpgp');
const fs = require("fs");

const generateKeyPair = async () => {
    const { privateKey, publicKey } = await openpgp.generateKey({
        curve: 'ed25519',
        userIDs: [
            {
                name: 'AoS Crazy', email: 'vmhotshot@gmail.com',
                comment: 'This key is for public sharing'
            }
        ],
        passphrase: '20OCUG31!n_1!44c120OCUG31!n_1!43c1',
    });

    console.log(publicKey);
    console.log(privateKey);

    fs.writeFileSync('pubKey', publicKey);
    fs.writeFileSync('Key', privateKey);
}



const encryptFile = async () => {
  const file = fs.readFileSync('file-decrypt.txt');
  const publicKey = fs.readFileSync('pubKey').toString();

  const fileString = file.toString();
  console.log(fileString);
  //const fileForOpenpgpjs = new Uint8Array(file);
  const message = await openpgp.createMessage({text :fileString});

  const openpgpPublicKey = await openpgp.readKey({armoredKey : publicKey});
  
  const options = {
    message : message,
    encryptionKeys: openpgpPublicKey,
    //signingKeys :  openpgpPrivateKey
  }; 

  const encryptionResponse = await openpgp.encrypt(options);
  console.log(encryptionResponse);

  //const encryptedFile = encryptionResponse.message.packets.write();
  fs.writeFileSync('license', encryptionResponse); 

}

const decryptFile = async() => {

  const privateKey = fs.readFileSync('Key').toString();

const privateArmouredKey = await openpgp.readPrivateKey({armoredKey : privateKey});
const openpgpPrivateKey =  await openpgp.decryptKey({privateKey : privateArmouredKey, 
                                        passphrase : '20OCUG31!n_1!44c120OCUG31!n_1!43c1'});


const file = fs.readFileSync('license');
const fileString = file.toString();


const message = await openpgp.readMessage({
  armoredMessage: fileString // parse armored message
});

// const { data: decrypted, signatures }
  const decryptedResponse= await openpgp.decrypt({
      message,
      decryptionKeys: openpgpPrivateKey
  });

  console.log(decryptedResponse);

};

function sleep(ms) {
  return new Promise((resolve) => {
      setTimeout(resolve, ms);
  });
}

encryptFile();

//decryptFile();

//generateKeyPair();
