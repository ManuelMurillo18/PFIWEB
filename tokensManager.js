
import * as utilities from './utilities.js';
import * as ServerVariables from "./serverVariables.js";
import crypto from 'crypto';

global.cachedTokens = [];
global.tokenLifeDuration = ServerVariables.get("main.token.lifeDuration");
global.tokensCleanerStarted = false;

export default class TokensManager {
    static create(user) {
        if (!tokensCleanerStarted) {
            tokensCleanerStarted = true;
            TokensManager.startTokensCleaner();
        }
        let token = TokensManager.findUserToken(user.Id);
        if (!token) {
            token = TokensManager.createToken(user);
            token.Expire_Time = utilities.nowInSeconds() + tokenLifeDuration;
            cachedTokens.push(token);
            console.log(BgGreen + FgWhite, "User " + token.User.Name + " logged in");
        } else
            console.log(BgGreen + FgWhite, "User " + token.User.Name + " already logged in");
        return token;
    }
    static findUserToken(userId) {
        for (let token of cachedTokens) {
            if (token.User.Id == userId) {
                token.Expire_Time = utilities.nowInSeconds() + tokenLifeDuration; // renew expiration date
                return token;
            }
        }
        return null;
    }
    static createToken(user = null) {
        let token = {};
        if (user) {
            token.Access_token = TokensManager.makeToken(user.Email);
            token.User = user;
        }
        return token;
    }
    static makeToken(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);

        function encrypt(text) {
            let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return {
                iv: iv.toString('hex'),
                encryptedData: encrypted.toString('hex')
            };
        }
        return encrypt(text).encryptedData;
    }
    static startTokensCleaner() {
        // periodic cleaning of expired tokens
        setInterval(TokensManager.clean, tokenLifeDuration * 1000);
        console.log(BgGreen + FgWhite, "Periodic tokens cleaning process started...");
    }
    static clean() {
        for (let token of cachedTokens) {
            // console.log('token.Expire_Time ', token.Expire_Time, ' utilities.nowInSeconds() ', utilities.nowInSeconds())
            if (token.Expire_Time > utilities.nowInSeconds())
                console.log(BgGreen + FgWhite, `Token of user ${token.User.Name} has expired.`);
        }
        cachedTokens = cachedTokens.filter(token => token.Expire_Time > utilities.nowInSeconds());
    }
    static logout(userId) {
        cachedTokens = cachedTokens.filter(token => token.User.Id != userId);
    }
    static findAccesToken(access_token, renew = true) {
        for (let token of cachedTokens) {
            if (token.Access_token == access_token) {
                if (renew)
                    token.Expire_Time = utilities.nowInSeconds() + tokenLifeDuration; // renew expiration date
                return token;
            }
        }
        return null;
    }
    static getUser(req) {
        if (req.headers["authorization"] != undefined) {
            // Extract bearer token from head of the http request
            let access_token = req.headers["authorization"].replace('Bearer ', '');
            let token = this.findAccesToken(access_token);

            if (token && token.User) {
                console.log(token.User)
                return token.User;
            }
        }
        return null;
    }
}


