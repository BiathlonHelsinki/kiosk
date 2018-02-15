
module.exports = {
  global_device: async function () {
    let devices = await freefare.listDevices();
    await devices[0].open(); 
		return devices[0];
  }
}
