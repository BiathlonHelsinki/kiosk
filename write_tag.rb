require_relative './highlander/lib/highlander'
require_relative './ruby-nfc-1.3/lib/ruby-nfc'
#require 'ruby-nfc'
@reader = readers = NFC::Reader.all[0] 
require 'timeout'
require 'securerandom'
begin
Timeout::timeout(5) { 
  @reader.poll(Mifare::Classic::Tag, Mifare::Ultralight::Tag) do |tag|
    begin
      case tag
      when Mifare::Classic::Tag
        if tag.auth(4, :key_a, "FFFFFFFFFFFF")
          # p "Contents of block 0x04: #{tag.read.unpack('H*').pop}"
          rnd = Array.new(16).map{rand(255)}.pack('C*')
          tag.write(rnd)
          # p "New value: #{rnd.unpack('H*').pop}"

          @tag = tag.uid_hex + '---' + rnd.unpack('H*').pop
          puts @tag
          # puts 'tag id is ' + tag.uid_hex + ' and tag is ' + rnd.unpack('H*').pop
        end
        if !@tag.nil?
          if @tag.length > 4
            break
          end
        end
      when Mifare::Ultralight::Tag
        tag_id = tag.read(0).unpack('H*').pop + tag.read(1).unpack('H*').pop + tag.read(2).unpack('H*').pop
        # p '7-byte tag write is  ' + tag_id.to_s.gsub(/\d{4$}/, '')
        rnd = SecureRandom.hex(4)
        tag.write(rnd, 4)
        @tag = tag_id.to_s.gsub(/0000$/, '') +  '---' + rnd
        # p 'writing tag: ' + @tag.to_s
        puts @tag
        unless @tag.nil?
          if @tag.length > 4
            break
          end
        end
    end
    rescue Exception => e
      @tag = e
      p "error here: " + e.inspect
      break
    end
  end
}
rescue Timeout::Error 
  exit
end