# -*- mode: ruby -*-
# vi: set ft=ruby :

VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/bionic64"
  config.vm.network :forwarded_port, host: 8006, guest: 8005
  config.vm.network :forwarded_port, host: 35729, guest: 35729
  # to run tests:
  config.vm.network :forwarded_port, host: 9876, guest: 9876

  # to make accessible in other VMs on same private network
  config.vm.network "private_network", type: "dhcp"

  config.vm.provider :virtualbox do |vb|
      vb.customize ["modifyvm", :id, "--memory", "2024", "--cpus", 1]
  end

  config.vm.provision :shell, :path => "setup/vagrant/bootstrap.sh"

end
