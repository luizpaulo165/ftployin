const path = require('path');
const modal = require('electron-modal');
const Deploy = require(path.join(__dirname, 'src/js/data/deploy.js'));
const methods = {};
const computed = {};
const dd = function (obj) {
    if (obj instanceof Error) {
        obj = {
            message: obj.message,
            stack: obj.stack
        }
    } 
    console.log(JSON.stringify(obj, null, 2));
}

methods.processDeploy = function () {
    const files = this.files.filter(f => f.selected);
    const onProgress = (item) => this.onProgress(item);

    this.deploy.parseQueue(files)
        .then((queue) => {
            this.deploying = true;
            this.progress.total = queue.length;
            
            return this.deploy.processQueue(queue, onProgress);
        })
        .then(() => {
            this.feedback = 'uploading virtual files...';
            return this.deploy.uploadVirtualFiles();
        })
        .then(() => {
            this.feedback = 'writing log files...';
            return this.deploy.writeRemoteLog(this.diff);
        })
        .then(() => {
            this.deploying = false;
            this.onDoneDeploy();
        })
        .catch((err) => {
            this.deploying = false;
            this.onError(err);
        })
};

methods.onProgress = function (item) {
    this.progress.cur = this.progress.cur + 1;
    this.feedback = `progress ${(100 / this.progress.total * this.progress.cur)}%`
}

methods.onDoneDeploy = function () {
    this.feedback = 'updating remote config file...';
    this.deploy.updateLastRemoteCommit(this.diff.to)
        .then(() => {
            this.feedback = null;
            this.deploy.disconnect();
            this.done = true;
        })
};

methods.onError = function (error) {
    console.log(error);
    modal.emit('error', error.message || error);
    // modal.close();
}

modal.getData().then((data) => {
    data.vueLoaded = true;
    data.feedback = null;
    data.progress = {cur: 0, total: 0};
    data.title = `deploy  ̶ ${data.env.name}`;
    data.deploying = false;
    data.files = [];
    data.connected = false;
    data.updatingRemoteFile = false;
    data.loaded = false;
    data.done = false;
    data.diff = {
        from: null,
        to: null
    }

    data.deploy = new Deploy(data.projectPath, data.env);
    data.feedback = 'connecting with ftp server...';

    data.deploy.connect()
        .then(() => {
            data.feedback = 'connected';
            data.connected = true;
            return data.deploy.getDiffParams();
        })
        .then(diff => {
            data.feedback = null;
            data.diff = diff;
            return data.deploy.getDiff(diff.from, diff.to);
        })
        .then(list => {
            data.files = list;
            data.loaded = true;
        })
        .catch(err => {
            modal.emit('error', err.message || err);
            modal.close();
        });


    const app = new Vue({ el: '#modal', data, methods, computed });
});